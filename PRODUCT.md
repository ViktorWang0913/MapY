# Product

## Register

product

## Product Name

MapY

## Product Type

Local-first 2D Metroidvania map planning tool.

MapY is not a generic diagram editor, SaaS dashboard, or playful map toy. It is a focused level-design workbench for solo developers and small teams who need to plan connected scenes, internal structures, identifiers, and world layout in one quiet editor.

## Users

MapY serves solo game developers and level designers building 2D Metroidvania-style maps.

The primary user works alone or in a small team. They need to sketch scene boundaries, internal structures, identifiers, connections, and world layout. They expect the tool to stay close to the level-design workflow rather than become a generic diagram editor.

### Primary Users

- Solo Metroidvania developers
- Indie level designers
- Small game teams
- Game design students
- Technical designers planning scene-to-scene progression
- Creators who need a structured world-map planning tool before building levels in an engine

### User Context

The user is usually designing before implementation. They are not looking for a marketing-like visual canvas. They need a practical workspace where scenes, structures, identifiers, and connections remain visible, editable, and exportable.

### User Needs

- Create a new project from zero
- Add and manage scenes
- Draw scene boundaries and internal structure pixels
- Place reusable identifiers
- Connect scenes into a world layout
- Review the complete world map
- Save a versioned JSON file
- Export images for review, communication, and documentation
- Keep ownership of files local and understandable

## Product Purpose

MapY exists to turn single-scene map design into a complete world-map planning flow.

A successful session lets the user create scenes, draw structure pixels, place reusable identifiers, connect scenes, review the world map, save a versioned JSON file, and export images without leaving the editor.

## Product Positioning

MapY is a focused creative workbench for 2D level planning.

### Short Positioning

A quiet technical map workbench for planning Metroidvania-style worlds.

### One-line Value Proposition

Design connected 2D game worlds from scene boundaries to complete world maps.

### Product Promise

MapY helps a solo creator turn scattered scene ideas into a structured, connected, exportable world map.

### Not This

MapY is not:

- a generic whiteboard
- a generic flowchart tool
- a playful mobile editor
- a professional GIS system
- a 3D modeling app
- an AI content-generation landing page
- a corporate SaaS productivity dashboard

## Core Workflow

The product workflow should remain direct and task-driven.

```text
Create Project
→ Create Scene
→ Draw Structure Pixels
→ Place Identifiers
→ Connect Scenes
→ Review World Map
→ Save Versioned JSON
→ Export Image
```

## Product Modes

MapY should make working modes clear without overexplaining them.

### Scene Mode

Used for single-scene design.

Expected functions:

- draw scene boundary
- draw internal structure pixels
- place identifiers
- inspect scene-level layout
- edit scene metadata

### Identifier Mode

Used for reusable gameplay markers.

Expected functions:

- create identifier
- assign name
- assign shape
- assign color
- place identifier on scene
- reuse identifier across scenes

### Connection Mode

Used for level progression and world structure.

Expected functions:

- connect scenes
- define direction or relationship
- inspect scene graph
- clarify routes between areas

### World Mode

Used for complete map review.

Expected functions:

- view all scenes
- inspect scene connections
- identify disconnected regions
- export world image
- save project state

## Information Hierarchy

The UI must clearly distinguish:

1. Project
2. World map
3. Scene
4. Structure pixels
5. Identifiers
6. Connections
7. Modes
8. Export / Save state

Hierarchy should be visible through layout, contrast, labels, shapes, and interaction state. Color can support hierarchy but must not be the only indicator.

## Brand Personality

Precise, workbench-like, and quietly technical.

The product should feel like a serious creative tool: dark blueprint surfaces, direct controls, visible structure, and no marketing noise inside the editor.

### Expanded Personality

- precise
- restrained
- technical
- local-first
- workbench-like
- map-focused
- quiet
- structural
- serious but usable
- creative without being decorative

## Visual Style

### Primary Art Direction

Minimal sci-fi, inspired by the Death Stranding series.

The visual language should feel calm, industrial, lonely, precise, cinematic, and technical. It should not copy any official Death Stranding assets, logos, characters, typography, interface, or copyrighted visual elements. The reference should be treated only as a broad atmospheric direction.

### Style Translation

Use the following visual principles:

- dark blueprint surfaces
- sparse interface composition
- high contrast black / white / gray
- subtle terrain contour lines
- quiet grid systems
- industrial spacing
- restrained amber highlights
- thin technical lines
- clear interaction states
- strong geometric alignment

### Editor Feeling

The editor should feel like a technical creative instrument, not a website. It should be quiet, functional, and close to the map-making task.

### Brand Page Feeling

The brand page can explain the product more clearly and commercially, but it should remain restrained. It should avoid loud marketing language and generic SaaS conversion patterns.

## Color System

### Dark Theme

| Role | Color |
|---|---|
| Background | `#080A0C` |
| Main Surface | `#111418` |
| Elevated Surface | `#171B20` |
| Text Primary | `#F4F4F1` |
| Text Secondary | `#A8ADB2` |
| Muted Text | `#6F767D` |
| Grid Line | `#252B31` |
| Structure Line | `#D8D8D2` |
| Accent Amber | `#D4A84F` |
| Error / Warning | `#C76B5A` |

### Light Theme

| Role | Color |
|---|---|
| Background | `#F5F4EF` |
| Main Surface | `#E8E6DE` |
| Elevated Surface | `#FFFFFF` |
| Text Primary | `#151719` |
| Text Secondary | `#5F656B` |
| Muted Text | `#8B8E90` |
| Grid Line | `#C8C5BA` |
| Structure Line | `#1A1D20` |
| Accent Amber | `#D4A84F` |
| Error / Warning | `#A95245` |

### Color Rules

- Use black, graphite, white, and gray as the main system.
- Use amber only for active states, CTA, selected nodes, active routes, current mode, and key highlights.
- Do not use multiple accent colors for decoration.
- Region and identifier colors are allowed only when they carry functional meaning.
- Any color-coded identifier must also have a label, shape, or icon.
- Maintain practical WCAG AA contrast for text and controls.

## Typography

### Typography Direction

Use a modern geometric sans-serif. The type should be readable before it feels futuristic.

### Rules

- Use compact labels for tools and modes.
- Use wide letter spacing only for major headings and system labels.
- Avoid expressive decorative typography.
- Avoid long explanatory text inside the editor.
- Use short control labels.
- Let brand pages explain. Let product UI operate.

### Text Tone

Editor copy should be direct:

- Create Scene
- Add Identifier
- Connect Scene
- Export Image
- Save JSON
- World View
- Scene View

Avoid:

- Let’s unlock your creativity
- Supercharge your workflow
- AI-powered productivity
- Start your journey
- Build anything with magic

## Layout Principles

### Product UI Layout

Use a workbench layout.

Recommended structure:

```text
Top Bar: project name / save state / export
Left Panel: scene list / project structure
Center Canvas: scene or world map
Right Panel: properties / selected item
Bottom or Floating Bar: mode switch / zoom / coordinates
```

### Layout Rules

- Keep the canvas dominant.
- Keep panels narrow and functional.
- Avoid decorative cards.
- Avoid marketing copy inside the editor.
- Make current mode visible.
- Make selected object state visible.
- Keep save/export controls consistently available.
- Keep local file ownership understandable.

## Interaction Principles

1. Prefer direct manipulation over modal explanation.
2. Make drawing and placement immediate.
3. Keep mode changes explicit.
4. Use hover and selection states to clarify behavior.
5. Use modals only for necessary file, project, or export actions.
6. Avoid onboarding overlays unless the user requests guidance.
7. Do not hide core controls behind ambiguous icons.

## Accessibility & Inclusion

Target practical WCAG AA contrast for text and controls.

Keyboard access should remain available for menus and forms. Motion should be limited and respectful of reduced-motion settings. Color is useful for regions and identifiers, but labels and shapes must carry meaning when color is insufficient.

### Requirements

- Keyboard navigable menus and forms
- Visible focus states
- Reduced-motion support
- Text labels for critical controls
- Non-color meaning indicators
- Sufficient contrast in both dark and light themes

## Motion Principles

Motion should clarify product behavior, not decorate the page.

### Allowed Motion

- subtle selected-node pulse
- route highlight when connecting scenes
- gentle panel slide
- quiet hover transition
- minimal canvas zoom easing
- slow background contour drift on brand page only

### Avoid

- flashy transitions
- cartoon bounce
- heavy particles
- excessive parallax
- fast animated gradients
- motion that interferes with drawing accuracy

## Anti-references

MapY should not look like a generic SaaS dashboard, a playful mobile game editor, a beige portfolio page, or an over-decorated AI landing page.

Avoid decorative cards, vague productivity claims, bloated onboarding copy, and UI text that explains obvious controls.

Additional anti-references:

- generic Notion-style productivity pages
- purple-blue AI landing pages
- playful Figma community templates
- over-glowing cyberpunk UI
- fake 3D app showcases with no workflow clarity
- corporate analytics dashboards
- whimsical map-making toys

## Design Principles

1. Keep the editor close to the map-making task.
2. Prefer direct manipulation over modal explanation.
3. Make hierarchy visible: scenes, structures, identifiers, connections, and modes should be easy to distinguish.
4. Keep file ownership local and understandable.
5. Let the brand page explain the product; keep the product UI quiet.
6. Make the canvas the center of attention.
7. Make modes clear without overexplaining.
8. Make export and save behavior predictable.
9. Use style to support structure, not replace it.
10. Avoid generic visual polish that weakens product identity.

## Brand Page Direction

The brand page should communicate the product clearly without becoming noisy.

### Brand Page Goal

Help users understand:

- MapY is for 2D Metroidvania-style map planning.
- It helps move from single scenes to connected world maps.
- It supports scenes, structures, identifiers, connections, JSON saving, and image export.
- It is local-first and practical.
- It is a serious creative tool.

### Recommended Brand Page Sections

1. Hero
2. Demo Preview
3. Workflow
4. Core Features
5. Product Modes
6. Export / Local File Ownership
7. Final CTA

## Brand Page Copy

### Hero

**Headline:**  
Design connected 2D game worlds with precision.

**Subheadline:**  
MapY helps solo developers plan Metroidvania-style scenes, structures, identifiers, and world connections in one quiet editor.

**Primary CTA:**  
Open Editor

**Secondary CTA:**  
View Demo

**Support Line:**  
Local-first map planning for solo game developers and small teams.

### Demo Preview

**Title:**  
From scene sketch to world map.

**Description:**  
Create scenes, draw structure pixels, place identifiers, connect areas, and review the full world layout without leaving the editor.

**Labels:**  
Scenes / Structures / Identifiers / Connections / World View

### Workflow Section

**Title:**  
A complete map-planning flow.

Steps:

1. **Create scenes**  
   Define the spaces that make up your world.

2. **Draw structures**  
   Sketch boundaries, rooms, routes, and internal scene pixels.

3. **Place identifiers**  
   Reuse markers for doors, items, gates, bosses, save points, and regions.

4. **Connect the world**  
   Link scenes into a readable world map.

5. **Save and export**  
   Save a versioned JSON file and export images for review or documentation.

### Core Features

1. **Scene-based map planning**  
   Build your world from individual scenes instead of loose diagrams.

2. **Structure pixel drawing**  
   Draw practical level structure directly on the canvas.

3. **Reusable identifiers**  
   Create consistent symbols for gameplay objects, routes, gates, and landmarks.

4. **World map connections**  
   Connect scenes and inspect the larger world layout.

5. **Local JSON ownership**  
   Save versioned project files you can understand, store, and back up.

6. **Image export**  
   Export clean visuals for planning, communication, and documentation.

### Product Modes

- **Scene Mode**: draw and edit a single scene.
- **Identifier Mode**: create and place reusable symbols.
- **Connection Mode**: link scenes and clarify progression.
- **World Mode**: review the complete map.

### Final CTA

**Title:**  
Start planning your world map.

**Subtext:**  
Create scenes, structure them, connect them, and keep the project file yours.

**Primary CTA:**  
Open MapY

**Secondary CTA:**  
View Demo

## Impeccable Prompt

```text
Design a high-conversion but restrained brand page for “MapY”.

MapY is a local-first 2D Metroidvania map planning tool for solo game developers and small teams. It helps users create scenes, draw structure pixels, place reusable identifiers, connect scenes, review the world map, save a versioned JSON file, and export images without leaving the editor.

The page should not feel like a generic SaaS dashboard or an over-decorated AI landing page. It should feel like a serious creative workbench for level design.

Visual style:
Use a minimal sci-fi style inspired by the Death Stranding series, without copying any official assets, characters, logos, typography, UI, or copyrighted material.

The page should feel:
- precise
- workbench-like
- quietly technical
- calm
- industrial
- sparse
- premium
- directly useful

Use:
- dark blueprint surfaces
- black / graphite / white / gray
- muted amber accent
- subtle topographic contour lines
- faint grid systems
- thin technical linework
- large negative space
- strict alignment
- visible hierarchy

Do not use:
- generic SaaS cards
- playful mobile game UI
- beige portfolio layout
- bloated onboarding copy
- vague productivity claims
- neon cyberpunk overload
- cartoon illustrations
- blockchain or AI hype style
- decorative elements that do not explain the map-making workflow

Primary users:
- solo Metroidvania developers
- indie level designers
- small game teams
- game design students
- technical designers planning scene-to-scene progression

Core message:
MapY helps solo developers turn single-scene sketches into complete connected world maps.

Hero:
Headline:
“Design connected 2D game worlds with precision.”

Subheadline:
“MapY helps solo developers plan Metroidvania-style scenes, structures, identifiers, and world connections in one quiet editor.”

Primary CTA:
“Open Editor”

Secondary CTA:
“View Demo”

Support line:
“Local-first map planning for solo game developers and small teams.”

Hero visual:
Show a dark blueprint-style editor preview:
- scene grid
- structure pixels
- reusable identifiers
- connection lines
- world map preview
- muted amber active path or selected node

Page structure:
1. Hero
2. Demo Preview
3. Workflow
4. Core Features
5. Product Modes
6. Export / Local File Ownership
7. Final CTA

Demo Preview:
Title:
“From scene sketch to world map.”

Description:
“Create scenes, draw structure pixels, place identifiers, connect areas, and review the full world layout without leaving the editor.”

Show an editor UI:
- top bar with project name and save/export state
- left panel with scene list
- central canvas with scene or world map
- right panel with selected object properties
- mode switcher for Scene / Identifier / Connection / World
- visible grid, identifiers, structure pixels, and scene connections

Workflow:
Title:
“A complete map-planning flow.”

Steps:
1. Create scenes
2. Draw structures
3. Place identifiers
4. Connect the world
5. Save and export

Core Features:
- Scene-based map planning
- Structure pixel drawing
- Reusable identifiers
- World map connections
- Local JSON ownership
- Image export

Product Modes:
Show four mode cards:
- Scene Mode
- Identifier Mode
- Connection Mode
- World Mode

Keep mode cards functional and minimal. Do not make them decorative.

Export / Local File Ownership:
Explain that users can save a versioned JSON file and export images. Keep this section practical and direct.

Final CTA:
Title:
“Start planning your world map.”

Subtext:
“Create scenes, structure them, connect them, and keep the project file yours.”

Primary CTA:
“Open MapY”

Secondary CTA:
“View Demo”

Conversion rules:
- Product should be understandable within 5 seconds.
- Demo preview should appear before heavy explanation.
- Every section should clarify the map-making workflow.
- CTA should appear in Hero, Demo, and Final section.
- Copy should be concise and practical.
- The editor should feel quiet and task-focused.
- The brand page can explain, but the product UI should remain silent and direct.

Accessibility:
- practical WCAG AA contrast
- visible keyboard focus
- reduced-motion support
- labels and shapes must carry meaning when color is insufficient

Animation:
Use restrained functional motion:
- subtle selected-node pulse
- route highlight when connecting scenes
- gentle panel slide
- quiet hover transition
- slow contour drift only in the brand page background

Avoid fast motion, bounce effects, heavy particles, and excessive parallax.
```

## Impeccable Refinement Commands

### /typeset

```text
/typeset
Refine typography for a restrained minimal sci-fi product page.

Use a modern geometric sans-serif.
Keep body text concise and practical.
Use wide letter spacing only for labels, modes, and section markers.
Make headings precise, calm, and technical.
Avoid playful, decorative, or marketing-heavy typography.
The page should feel like a serious level-design workbench.
```

### /layout

```text
/layout
Rebuild the page layout around the actual MapY workflow.

Prioritize:
1. Hero
2. Demo Preview
3. Workflow
4. Core Features
5. Product Modes
6. Export / Local File Ownership
7. Final CTA

Make the canvas/editor preview dominant.
Use a strict grid, large negative space, and clear hierarchy.
Avoid generic SaaS card layouts.
Make scenes, structures, identifiers, connections, and modes visually distinct.
```

### /colorize

```text
/colorize
Apply a dark blueprint minimal sci-fi color system.

Use:
- black / graphite surfaces
- white primary text
- gray secondary text
- muted amber only for active path, selected node, CTA, or current mode
- subtle grid lines
- subtle topographic contours

Ensure readable contrast in dark and light themes.
Do not use playful colors, neon cyberpunk palettes, or decorative gradients.
```

### /animate

```text
/animate
Add restrained functional motion only.

Use:
- selected node subtle pulse
- route highlight during connection preview
- gentle panel slide
- quiet hover transitions
- reduced-motion friendly behavior

Do not use bounce, fast transitions, heavy particles, or excessive parallax.
Motion should clarify scene connection, selection, and export state.
```

### /impeccable critique

```text
/impeccable critique
Critique and revise the page according to the official MapY product definition.

Check:
1. Does it serve solo developers and level designers building 2D Metroidvania-style maps?
2. Does it avoid becoming a generic diagram editor?
3. Does it show the workflow: scenes → structure pixels → identifiers → connections → world map → JSON save → image export?
4. Does the page feel precise, workbench-like, and quietly technical?
5. Does the editor preview avoid marketing noise?
6. Are scenes, structures, identifiers, connections, and modes visually distinct?
7. Is local file ownership clear?
8. Does it avoid generic SaaS dashboard style?
9. Does it avoid playful mobile editor style?
10. Does it meet practical accessibility expectations?

Then revise hierarchy, copy, layout, color, and motion to better match MapY.
```

## Quality Checklist

Before finalizing, verify:

- The page is clearly about 2D Metroidvania map planning.
- The user understands the product within 5 seconds.
- The demo shows a real editor workflow, not a generic mockup.
- Scenes, structures, identifiers, connections, and modes are visually clear.
- The page explains JSON save and image export.
- The editor remains quiet and task-focused.
- The brand page avoids generic SaaS language.
- The art direction is minimal sci-fi, not overdecorated.
- Amber is used only for meaningful highlights.
- Accessibility is considered in color, labels, focus, and motion.
