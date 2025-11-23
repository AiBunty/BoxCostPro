# Design Guidelines: Portfolio Case Study Platform

## Design Approach

**Reference-Based Approach** drawing from Behance, Dribbble, and premium agency portfolios (IDEO, Huge). This portfolio platform prioritizes visual storytelling and showcasing work immediately—no traditional hero section.

## Core Design Principles

1. **Work-First Philosophy**: Lead with portfolio grid, not marketing copy
2. **Visual Hierarchy**: Let imagery and case studies drive engagement
3. **Global Accessibility**: Seamless multi-language experience
4. **Professional Polish**: Clean, modern aesthetic that doesn't compete with showcased work

## Typography

**Font Selection**: Google Fonts via CDN
- **Primary (Headings)**: Inter - weights 600, 700, 800
- **Secondary (Body)**: Inter - weights 400, 500
- **Display (Hero/Large)**: Inter - weight 700

**Scale**:
- Page titles: text-5xl (60px)
- Section headings: text-3xl (36px)
- Card titles: text-xl (20px)
- Body text: text-base (16px)
- Captions/meta: text-sm (14px)

## Layout System

**Spacing Primitives**: Tailwind units of 2, 4, 6, 8, 12, 16
- Tight spacing: p-2, gap-4
- Component padding: p-6, p-8
- Section spacing: py-12, py-16
- Large gaps: gap-8, gap-12

**Grid System**:
- Desktop: 3-column masonry grid (lg:grid-cols-3)
- Tablet: 2-column grid (md:grid-cols-2)
- Mobile: Single column (grid-cols-1)
- Container: max-w-7xl mx-auto

## Page Structure

### Navigation Header (Sticky)
- Logo (left)
- Category filters (center): All, Design, Development, Marketing, Strategy
- Language switcher with flag icons (right): EN | ES | FR | DE
- Search icon button
- Spacing: px-6 py-4

### Portfolio Grid Section
- **No traditional hero** - immediately display portfolio work
- Brief welcome text above grid: Single line with event context
- Masonry-style card grid with hover effects
- Each card: Project thumbnail, title, category tag, brief description (2 lines)
- Staggered heights for visual interest
- Gap: gap-6 (desktop), gap-4 (mobile)

### Portfolio Cards
- Image aspect ratio: 4:3 or 16:9 (varies)
- Overlay on hover: Semi-transparent with "View Case Study" CTA
- Category badge: Top-left corner with rounded pill
- Project metadata: Client name, year, role

### Case Study Detail Page
- Full-width hero image (16:9 aspect ratio)
- Project title overlay on hero with blurred button background for CTA
- Two-column layout: 
  - Left (60%): Story, challenge, solution, results with rich imagery
  - Right (40%): Sticky sidebar with project details, team, timeline, technologies
- Image gallery grid: 2-column on desktop
- Pull quotes: Blockquote styling with large text
- Metrics section: 3-column stats grid with large numbers

### Filter & Search Bar
- Horizontal pill buttons for categories
- Search input with icon: rounded-full, subtle border
- Active state: filled background for selected category
- Position: Below welcome text, above grid

### Footer
- Three-column layout
  - Company info with logo
  - Quick links (About, Contact, Submit Work)
  - Social media icons + newsletter signup
- Multi-language disclaimer
- Copyright and event information

## Component Library

**Icons**: Heroicons via CDN (outline style)
- Search, language globe, external link, chevrons, close
- Category icons for each filter type

**Buttons**:
- Primary: Rounded, medium padding (px-6 py-3)
- Secondary: Outlined version
- On hero images: Backdrop blur effect (backdrop-blur-md bg-white/20)

**Cards**:
- Rounded corners: rounded-lg
- Subtle shadow: shadow-md, hover:shadow-xl transition
- Image: object-cover with rounded-t-lg

**Language Switcher**:
- Dropdown or horizontal tabs
- Flag icons (20x15px) + language code
- Active language: bold weight

**Tags/Badges**:
- Rounded-full pills
- Small text: text-xs
- Padding: px-3 py-1

**Search**:
- Full-width modal overlay on click
- Large search input with autocomplete
- Recent searches below

## Images

**Hero Images**: 
- NO large hero on homepage - work grid is the hero
- Case study pages: Full-width hero image at 16:9 ratio (1920x1080px)
- Imagery should showcase the featured work with high quality

**Portfolio Thumbnails**:
- Varying aspect ratios for masonry effect
- High-quality project screenshots or photography
- Minimum 800x600px resolution

**Case Study Images**:
- Process images, final deliverables, team photos
- Before/after comparisons where relevant
- Full-bleed images between text sections
- Image captions with subtle text-sm styling

## Accessibility

- ARIA labels for language switcher and category filters
- Keyboard navigation for all interactive elements
- Focus states: ring-2 ring-offset-2
- Alt text for all portfolio images with project context
- Semantic HTML: nav, main, article, aside elements

## Responsive Behavior

- Grid collapses: 3 → 2 → 1 columns
- Navigation: Hamburger menu on mobile with slide-out drawer
- Language switcher: Compact dropdown on mobile
- Case study sidebar: Below content on mobile (stacked)
- Touch-friendly tap targets: minimum 44x44px

This design creates an immersive, work-first experience that respects the showcased projects while providing robust filtering, search, and multi-language capabilities for global event attendees.