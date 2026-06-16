import {
  ArrowRight,
  Bot,
  Copy,
  Download,
  FileJson,
  Grid3X3,
  Image,
  Mail,
  Map,
  Play,
  Route,
  Shapes,
  X
} from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import mapyLogo from '../assets/mapy-logo.png';

const windowsInstaller = import.meta.env.VITE_MAPY_WINDOWS_DOWNLOAD_URL || '/downloads/MapY_0.1.0_x64-setup.exe';
const releaseVersion = import.meta.env.VITE_MAPY_RELEASE_VERSION || '0.1.0';
const releaseUpdatedAt = import.meta.env.VITE_MAPY_RELEASE_DATE || '2026-06-15';
const feedbackEndpoint = import.meta.env.VITE_MAPY_FEEDBACK_ENDPOINT || '/api/feedback';
const contactEmail = 'mapy_zstudio@163.com';

const workflow = [
  { title: '创建场景', description: '定义组成世界的单个空间。' },
  { title: '绘制结构', description: '用像素绘制房间、边界、路线和内部结构。' },
  { title: '放置标识', description: '复用道具、Boss、存档点、门和关键节点。' },
  { title: '连接世界', description: '把场景串成可阅读的完整地图。' },
  { title: '保存导出', description: '保存版本化 JSON，并导出用于沟通的图片。' }
];

const features = [
  { icon: Map, title: '场景式地图规划', description: '从单个场景开始构建世界，减少白板式散乱图形。' },
  { icon: Grid3X3, title: '结构像素绘制', description: '在画布上直接绘制平台、房间、通路和内部结构。' },
  { icon: Shapes, title: '可复用标识', description: '为道具、门、Boss、存档点和地标建立一致的符号系统。' },
  { icon: Route, title: '世界连接关系', description: '在世界模式中查看门点、路线和场景之间的推进关系。' },
  { icon: FileJson, title: '本地 JSON 文件', description: '项目数据保存在你能理解、备份和版本管理的文件里。' },
  { icon: Image, title: '图片导出', description: '导出清晰地图图像，用于复盘、文档、团队沟通或展示。' }
];

const modes = [
  { title: '场景模式', description: '创建和编辑单个场景，检查场景范围与基础信息。' },
  { title: '结构模式', description: '进入指定场景内部，用像素绘制关卡结构。' },
  { title: '标识模式', description: '创建可复用标识，并把实例放入场景或结构。' },
  { title: '世界模式', description: '排列场景，检查区域、连接点和完整世界地图。' }
];

export function OpenSourcePage() {
  const [contactOpen, setContactOpen] = useState(false);

  useEffect(() => {
    document.body.classList.add('marketing-page-active');
    return () => document.body.classList.remove('marketing-page-active');
  }, []);

  return (
    <main className="open-source-page">
      <nav className="site-nav" aria-label="MapY 官网导航">
        <a className="site-brand" href="/">
          <img alt="" src={mapyLogo} />
          <span>MapY</span>
        </a>
        <div className="site-nav-actions">
          <a href="#demo">演示</a>
          <a href="#workflow">流程</a>
          <a href="#features">功能</a>
          <a href="#download">下载</a>
          <button type="button" onClick={() => setContactOpen(true)}>
            联系我们
          </button>
        </div>
      </nav>

      <section className="landing-hero">
        <TerrainField />
        <HeroPosterVisual />
        <div className="hero-copy">
          <div className="hero-logo-lockup">
            <img alt="MapY logo" src={mapyLogo} />
          </div>
          <h1>MapY</h1>
          <p>MapY 用场景、结构像素、标识和连接线组织2D游戏地图，适合早期原型、关卡草图和世界路线规划。</p>
          <div className="hero-actions">
            <a className="download-primary" href="/editor">
              打开编辑器
              <ArrowRight size={17} />
            </a>
            <a className="download-secondary" href="#demo">
              <Play size={16} />
              查看演示
            </a>
          </div>
        </div>
      </section>

      <section className="landing-section demo-section" id="demo">
        <div className="section-header">
          <h2>从场景到世界</h2>
        </div>
        <div className="demo-console">
          <ProductScreenshot />
          <div className="demo-actions">
            <span>场景</span>
            <span>结构</span>
            <span>标识</span>
            <span>连接</span>
            <a className="download-primary" href={windowsInstaller}>
              下载 Windows 版
            </a>
          </div>
        </div>
      </section>

      <section className="landing-section workflow-section" id="workflow">
        <div className="section-header">
          <h2>完整的地图规划流程</h2>
        </div>
        <div className="workflow-rail">
          {workflow.map((step, index) => (
            <article key={step.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section value-section" id="features">
        <div className="section-header">
          <h2>功能围绕地图设计展开</h2>
        </div>
        <div className="feature-grid">
          {features.map(({ icon: Icon, title, description }) => (
            <article className="feature-item" key={title}>
              <Icon size={26} strokeWidth={1.4} />
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section modes-section">
        <div className="section-header">
          <h2>模式分工明确</h2>
        </div>
        <div className="mode-board">
          {modes.map((mode) => (
            <article key={mode.title}>
              <span>{mode.title}</span>
              <p>{mode.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section ownership-section">
        <div className="ownership-copy">
          <h2>文件属于你</h2>
          <p>当前版本以本地使用和收集反馈为主。项目保存为版本化 JSON，地图可导出为图片，方便备份、传阅和接入后续开发。</p>
          <div className="ownership-actions">
            <a className="download-primary" href={windowsInstaller}>
              下载 MapY
            </a>
            <button className="download-secondary" type="button" onClick={() => setContactOpen(true)}>
              联系我们
            </button>
          </div>
        </div>
        <div className="file-stack" aria-label="MapY 本地文件能力">
          <article>
            <FileJson size={24} />
            <strong>MapY JSON</strong>
            <span>版本化项目文件</span>
          </article>
          <article>
            <Image size={24} />
            <strong>地图图片</strong>
            <span>用于评审和文档</span>
          </article>
          <article>
            <Download size={24} />
            <strong>本地安装</strong>
            <span>Windows 10/11 x64 · v{releaseVersion}</span>
          </article>
        </div>
      </section>

      <section className="final-cta" id="download">
        <TerrainField compact />
        <h2>MapY 已开放下载。</h2>
        <p>下载 Windows 版本，创建场景、绘制结构、放置标识，并导出你的第一张世界地图。</p>
        <div className="download-options">
          <a className="platform-download ready" href={windowsInstaller}>
            <Download size={22} />
            <strong>下载 Windows 版</strong>
            <span>v{releaseVersion} · {releaseUpdatedAt} · Windows 10/11 x64</span>
          </a>
          <button className="platform-download" type="button" onClick={() => setContactOpen(true)}>
            <Mail size={22} />
            <strong>联系工作室</strong>
            <span>反馈问题、提交建议或沟通合作。</span>
          </button>
        </div>
      </section>

      {contactOpen ? <ContactDialog onClose={() => setContactOpen(false)} /> : null}
    </main>
  );
}

function ProductScreenshot() {
  return (
    <figure className="product-screenshot">
      <img alt="MapY 程序界面：左侧部件栏、中央网格画布、右侧属性栏和底部截图按钮" src="/screenshots/mapy-editor-flow.png" />
    </figure>
  );
}

function HeroPosterVisual() {
  return (
    <div className="hero-poster-visual" aria-hidden="true">
      <div className="poster-corner top-left" />
      <div className="poster-corner top-right" />
      <div className="poster-corner bottom-left" />
      <div className="poster-corner bottom-right" />
      <div className="poster-readout">
      </div>
      <svg viewBox="0 0 1180 640" preserveAspectRatio="none" role="img">
        <defs>
          <pattern id="posterGrid" width="64" height="64" patternUnits="userSpaceOnUse">
            <path d="M64 0H0V64" />
          </pattern>
        </defs>
        <rect className="poster-grid" width="1180" height="640" fill="url(#posterGrid)" />
        <path className="poster-contour c1" d="M78 426c96-82 190-91 282-27 92 63 179 54 262-28 84-82 176-93 277-33 101 61 175 42 223-57" />
        <path className="poster-contour c2" d="M96 500c98-68 188-70 270-6 82 65 166 58 252-19 86-77 176-86 270-27 94 60 175 53 244-21" />
        <path className="poster-contour c3" d="M320 118c84 47 167 49 249 7 82-43 162-31 240 36 78 66 166 72 264 16" />
        <path className="poster-route" d="M132 476c112-102 210-107 294-15 82 89 162 78 239-34 77-112 167-127 271-46 61 48 112 42 153-17" />
        <circle className="poster-node n1" cx="132" cy="476" r="7" />
        <circle className="poster-node n2" cx="426" cy="461" r="7" />
        <circle className="poster-node n3" cx="665" cy="427" r="7" />
        <circle className="poster-node n4" cx="936" cy="381" r="7" />
        <rect className="poster-sector s1" x="140" y="132" width="128" height="72" />
        <rect className="poster-sector s2" x="682" y="122" width="184" height="92" />
        <rect className="poster-sector s3" x="884" y="466" width="130" height="64" />
      </svg>
    </div>
  );
}

function ContactDialog({ onClose }: { onClose: () => void }) {
  const [topic, setTopic] = useState('产品反馈');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [submitState, setSubmitState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const mailtoHref = useMemo(() => {
    const subject = encodeURIComponent(`MapY ${topic}`);
    const body = encodeURIComponent(`联系方式：${contact || '未填写'}\n\n反馈内容：\n${message || '请在这里补充你的问题或建议。'}`);
    return `mailto:${contactEmail}?subject=${subject}&body=${body}`;
  }, [contact, message, topic]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      setSubmitState('error');
      return;
    }

    setSubmitState('sending');

    try {
      const response = await fetch(feedbackEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          contact: contact.trim(),
          message: trimmedMessage,
          page: window.location.href
        })
      });

      if (!response.ok) {
        throw new Error('Feedback request failed.');
      }

      setSubmitState('sent');
      setMessage('');
    } catch {
      setSubmitState('error');
    }
  }

  async function copyEmail() {
    await navigator.clipboard?.writeText(contactEmail);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="landing-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="landing-contact-dialog" role="dialog" aria-modal="true" aria-labelledby="landing-contact-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="landing-dialog-close" type="button" aria-label="关闭" onClick={onClose}>
          <X size={18} />
        </button>
        <div className="contact-dialog-copy">
          <h2 id="landing-contact-title">联系 MapY</h2>
          <p>提交后会发送到 mapy_zstudio@163.com。若网络提交失败，可以复制邮箱或打开邮件草稿。</p>
        </div>
        <form className="landing-contact-form" onSubmit={handleSubmit}>
          <label>
            <span>反馈类型</span>
            <select value={topic} onChange={(event) => setTopic(event.target.value)}>
              <option>产品反馈</option>
              <option>安装问题</option>
              <option>功能建议</option>
              <option>合作沟通</option>
            </select>
          </label>
          <label>
            <span>你的联系方式</span>
            <input value={contact} onChange={(event) => setContact(event.target.value)} placeholder="邮箱、微信或其他联系方式" />
          </label>
          <label>
            <span>内容</span>
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="描述你遇到的问题、期待的功能或合作方向。" />
          </label>
          <div className="contact-actions">
            <button className="download-primary" disabled={submitState === 'sending'} type="submit">
              {submitState === 'sending' ? '发送中' : '发送反馈'}
            </button>
            <a className="download-secondary" href={mailtoHref}>
              打开邮件
            </a>
            <button className="download-secondary" type="button" onClick={copyEmail}>
              <Copy size={16} />
              {copied ? '已复制' : '复制邮箱'}
            </button>
          </div>
          {submitState === 'sent' && <p className="feedback-status success">已收到反馈。感谢你帮助 MapY 继续改进。</p>}
          {submitState === 'error' && <p className="feedback-status error">提交失败或内容为空。请补充内容后重试，或使用邮件方式发送。</p>}
        </form>
      </section>
    </div>
  );
}

function TerrainField({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'terrain-field cta-lines' : 'terrain-field'} aria-hidden="true">
      <svg viewBox={compact ? '0 0 1200 360' : '0 0 1200 760'} preserveAspectRatio="none">
        <path d="M0 218c115-78 220-82 314-12 93 70 188 72 283 6 94-66 193-61 297 15 104 76 206 79 306 10" />
        <path d="M0 282c125-72 235-76 330-12 96 65 189 65 281 0 91-64 191-61 299 9 108 70 205 71 290 4" />
        <path d="M0 470c132-58 246-57 342 3 96 60 184 58 264-6 80-64 174-70 281-16 107 53 211 49 313-12" />
        <path d="M92 642c90-44 173-40 249 12 76 53 155 51 236-5 82-56 171-57 267-3 96 55 185 47 268-23" />
      </svg>
    </div>
  );
}
