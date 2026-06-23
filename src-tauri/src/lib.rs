use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{sync::Mutex, time::Duration};

const MAX_JSON_BYTES: usize = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES: usize = 12 * 1024 * 1024;
const MAX_RETRIES: u32 = 3;
const BASE_BACKOFF_MS: u64 = 500;
const MAX_BACKOFF_SECS: u64 = 30;

#[derive(Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TextAiConfig {
  base_url: String,
  model: String,
  api_key: String,
  timeout_ms: u64,
}

#[derive(Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ImageAiConfig {
  base_url: String,
  endpoint: String,
  model: String,
  api_key: String,
  timeout_ms: u64,
}

#[derive(Default)]
struct AiState {
  text: Mutex<Option<TextAiConfig>>,
  image: Mutex<Option<ImageAiConfig>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MapPlanRequest {
  message: String,
  document_context: Value,
  system_prompt: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ImageRequest {
  prompt: String,
  width: u32,
  height: u32,
  transparent_background: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ImageResponse {
  mime_type: String,
  data: String,
  revised_prompt: Option<String>,
}

fn join_url(base: &str, path: &str) -> String {
  let base = base.trim_end_matches('/');
  let path = path.trim_start_matches('/');
  if base.ends_with(path) {
    base.to_string()
  } else {
    format!("{}/{}", base, path)
  }
}

fn client(timeout_ms: u64) -> Result<Client, String> {
  Client::builder()
    .timeout(Duration::from_millis(timeout_ms.clamp(1_000, 300_000)))
    .build()
    .map_err(|_| "无法创建 AI 请求客户端。".to_string())
}

async fn limited_json(response: reqwest::Response, max_bytes: usize, label: &str) -> Result<Value, String> {
  if !response.status().is_success() {
    let status = response.status();
    let url = response.url().to_string();
    let detail = response.bytes().await.ok()
      .and_then(|bytes| serde_json::from_slice::<Value>(&bytes[..bytes.len().min(4096)]).ok())
      .and_then(|body| body.pointer("/error/message").and_then(Value::as_str).map(str::to_string));
    return Err(match detail {
      Some(message) => format!("AI 服务请求失败（{}）：{}。地址：{}", status.as_u16(), message, url),
      None => format!("AI 服务请求失败（{}）。地址：{}", status.as_u16(), url)
    });
  }
  let bytes = response.bytes().await.map_err(|_| "无法读取 AI 响应。".to_string())?;
  if bytes.len() > max_bytes {
    return Err(format!("{}响应超过大小限制。", label));
  }
  serde_json::from_slice(&bytes).map_err(|_| "AI 服务返回了无效 JSON。".to_string())
}

async fn probe_endpoint(http: &Client, url: String, api_key: String, label: &str) -> Result<(), String> {
  let response = http.post(&url)
    .bearer_auth(api_key)
    .json(&json!({}))
    .send().await.map_err(|_| format!("无法连接{}服务。地址：{}", label, url))?;
  let status = response.status();

  if status.is_success() || matches!(status.as_u16(), 400 | 415 | 422) {
    return Ok(());
  }

  let detail = response.bytes().await.ok()
    .and_then(|bytes| serde_json::from_slice::<Value>(&bytes[..bytes.len().min(4096)]).ok())
    .and_then(|body| body.pointer("/error/message").and_then(Value::as_str).map(str::to_string));
  let suffix = detail.map(|message| format!("：{}", message)).unwrap_or_default();

  match status.as_u16() {
    401 | 403 => Err(format!("{}服务拒绝了 API Key（{}）{}。", label, status.as_u16(), suffix)),
    404 => Err(format!("{}端点不存在（404）。请检查 Base URL/端点：{}", label, url)),
    429 => Err(format!("{}服务触发限流或额度不足（429）{}。", label, suffix)),
    _ => Err(format!("{}服务测试失败（{}）{}。地址：{}", label, status.as_u16(), suffix, url))
  }
}

async fn send_text_chat(
  http: &Client,
  url: &str,
  config: &TextAiConfig,
  messages: Value,
  max_tokens: u32,
) -> Result<Value, String> {
  let structured_body = json!({
    "model": config.model,
    "response_format": { "type": "json_object" },
    "messages": messages,
    "max_tokens": max_tokens,
    "stream": false
  });
  let response = http.post(url)
    .bearer_auth(&config.api_key)
    .json(&structured_body)
    .send().await.map_err(|_| format!("文本 AI 请求失败。地址：{}", url))?;

  if response.status().is_success() {
    return limited_json(response, MAX_JSON_BYTES, "AI JSON ").await;
  }

  // Some OpenAI-compatible providers reject response_format with 400 or even
  // 404. Retry once using prompt-enforced JSON before reporting the error.
  if matches!(response.status().as_u16(), 400 | 404) {
    let fallback_body = json!({
      "model": config.model,
      "messages": structured_body["messages"].clone(),
      "max_tokens": max_tokens,
      "stream": false
    });
    let fallback = http.post(url)
      .bearer_auth(&config.api_key)
      .json(&fallback_body)
      .send().await.map_err(|_| format!("文本 AI 兼容模式请求失败。地址：{}", url))?;
    return limited_json(fallback, MAX_JSON_BYTES, "AI JSON ").await;
  }

  limited_json(response, MAX_JSON_BYTES, "AI JSON ").await
}

fn configured_text(state: &tauri::State<'_, AiState>) -> Result<TextAiConfig, String> {
  state.text.lock().map_err(|_| "AI 配置锁定失败。".to_string())?
    .clone().filter(|config| !config.api_key.is_empty())
    .ok_or_else(|| "请先配置文本 API。".to_string())
}

fn configured_image(state: &tauri::State<'_, AiState>) -> Result<ImageAiConfig, String> {
  state.image.lock().map_err(|_| "AI 配置锁定失败。".to_string())?
    .clone().filter(|config| !config.api_key.is_empty())
    .ok_or_else(|| "请先配置图片 API。".to_string())
}

#[tauri::command]
fn configure_text_ai(state: tauri::State<'_, AiState>, config: TextAiConfig) -> Result<(), String> {
  let mut stored = state.text.lock().map_err(|_| "AI 配置锁定失败。".to_string())?;
  let mut next = config;
  if next.api_key.is_empty() {
    next.api_key = stored.as_ref().map(|current| current.api_key.clone()).unwrap_or_default();
  }
  *stored = Some(next);
  Ok(())
}

#[tauri::command]
fn configure_image_ai(state: tauri::State<'_, AiState>, config: ImageAiConfig) -> Result<(), String> {
  let mut stored = state.image.lock().map_err(|_| "AI 配置锁定失败。".to_string())?;
  let mut next = config;
  if next.api_key.is_empty() {
    next.api_key = stored.as_ref().map(|current| current.api_key.clone()).unwrap_or_default();
  }
  *stored = Some(next);
  Ok(())
}

#[tauri::command]
async fn test_text_ai(state: tauri::State<'_, AiState>) -> Result<(), String> {
  let config = configured_text(&state)?;
  if config.base_url.trim().is_empty() {
    return Err("请填写文本 API Base URL。".to_string());
  }
  if config.model.trim().is_empty() {
    return Err("请填写文本模型 ID。".to_string());
  }
  let url = join_url(&config.base_url, "/chat/completions");
  let messages = json!([
    {
      "role": "system",
      "content": "Return JSON only. Example: {\"ok\":true}"
    },
    {
      "role": "user",
      "content": "Return a JSON object confirming the connection."
    }
  ]);
  send_text_chat(&client(config.timeout_ms)?, &url, &config, messages, 32).await?;
  Ok(())
}

#[tauri::command]
async fn test_image_ai(state: tauri::State<'_, AiState>) -> Result<(), String> {
  let config = configured_image(&state)?;
  let url = join_url(&config.base_url, &config.endpoint);
  probe_endpoint(&client(config.timeout_ms)?, url, config.api_key, "图片 AI").await
}

#[tauri::command]
async fn generate_ai_map_plan(state: tauri::State<'_, AiState>, request: MapPlanRequest) -> Result<String, String> {
  let config = configured_text(&state)?;
  if config.base_url.trim().is_empty() || config.model.trim().is_empty() {
    return Err("请先配置文本 API URL 和模型。".to_string());
  }
  let url = join_url(&config.base_url, "/chat/completions");
  let messages = json!([
    { "role": "system", "content": request.system_prompt },
    { "role": "user", "content": serde_json::to_string(&json!({
      "message": request.message,
      "documentContext": request.document_context
    })).map_err(|_| "无法编码地图上下文。".to_string())? }
  ]);
  let body = send_text_chat(&client(config.timeout_ms)?, &url, &config, messages, 8192).await?;
  let content = body.pointer("/choices/0/message/content").and_then(Value::as_str)
    .ok_or_else(|| "文本 AI 响应缺少 content。".to_string())?;
  Ok(content.to_string())
}

#[tauri::command]
async fn generate_ai_image(state: tauri::State<'_, AiState>, request: ImageRequest) -> Result<ImageResponse, String> {
  let config = configured_image(&state)?;
  let http = client(config.timeout_ms)?;
  let response = http
    .post(join_url(&config.base_url, &config.endpoint))
    .bearer_auth(&config.api_key)
    .json(&json!({
      "model": config.model,
      "prompt": request.prompt,
      "size": format!("{}x{}", request.width, request.height),
      "background": if request.transparent_background { "transparent" } else { "opaque" },
      "response_format": "b64_json",
      "n": 1
    }))
    .send().await.map_err(|_| "图片 AI 请求失败。".to_string())?;
  let body = limited_json(response, MAX_IMAGE_BYTES * 2, "图片 ").await?;
  let item = body.pointer("/data/0").ok_or_else(|| "图片 AI 响应缺少 data。".to_string())?;
  let revised_prompt = item.get("revised_prompt").and_then(Value::as_str).map(str::to_string);

  if let Some(data) = item.get("b64_json").and_then(Value::as_str) {
    let decoded = BASE64.decode(data).map_err(|_| "图片服务返回了无效 base64。".to_string())?;
    if decoded.len() > MAX_IMAGE_BYTES {
      return Err("生成图片超过大小限制。".to_string());
    }
    return Ok(ImageResponse { mime_type: "image/png".to_string(), data: data.to_string(), revised_prompt });
  }

  let url = item.get("url").and_then(Value::as_str).ok_or_else(|| "图片响应没有 b64_json 或 url。".to_string())?;
  let image_response = http.get(url).send().await.map_err(|_| "无法下载生成图片。".to_string())?;
  if !image_response.status().is_success() {
    return Err("生成图片下载失败。".to_string());
  }
  let mime_type = image_response.headers().get(reqwest::header::CONTENT_TYPE)
    .and_then(|value| value.to_str().ok()).unwrap_or("image/png").to_string();
  if !matches!(mime_type.as_str(), "image/png" | "image/jpeg" | "image/webp") {
    return Err("图片服务返回了不支持的格式。".to_string());
  }
  let bytes = image_response.bytes().await.map_err(|_| "无法读取生成图片。".to_string())?;
  if bytes.len() > MAX_IMAGE_BYTES {
    return Err("生成图片超过 12 MB 限制。".to_string());
  }
  Ok(ImageResponse { mime_type, data: BASE64.encode(bytes), revised_prompt })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(AiState::default())
    .invoke_handler(tauri::generate_handler![
      configure_text_ai,
      configure_image_ai,
      test_text_ai,
      test_image_ai,
      generate_ai_map_plan,
      generate_ai_image
    ])
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
