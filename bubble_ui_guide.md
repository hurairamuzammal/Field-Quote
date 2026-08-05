# Translating FieldQuote UI to Bubble.io

This guide provides the exact CSS values, hex codes, and settings you need to replicate the FieldQuote premium aesthetic inside the Bubble.io editor.

## 1. Typography & Fonts

First, ensure you have **Outfit** and **Manrope** installed in your Bubble app (Settings -> General -> Custom Fonts if they aren't available by default via Google Fonts).

### Headings (H1, H2, H3)
- **Font**: Outfit
- **Font Weight**: 800 (ExtraBold)
- **Text Color**: `#0B1D2C` (on light backgrounds) or `#FFFFFF` (on dark backgrounds)
- **Letter Spacing**: `-1` or `-1.5` (Bubble uses pixels for letter spacing, slightly negative makes it look premium and tight).
- **Capitalization**: ALL CAPS

### Body Text & Paragraphs
- **Font**: Manrope
- **Font Weight**: 400 (Regular) or 500 (Medium)
- **Base Size**: `16px` to `18px`
- **Line Spacing**: `1.6`

## 2. Color Palette

Store these as App Variables / Style Variables in Bubble:
- **Deep Navy Blue**: `#0B1D2C` (Primary background for dark sections)
- **Neon Cyan (Lime)**: `#00E0C4` (Primary CTA color, buttons, accents)
- **Cream**: `#F7F9FC` (Primary background for light sections)
- **White**: `#FFFFFF`

## 3. Border Radii (Corner Roundness)

Roundness is a massive part of this fluid aesthetic. In Bubble's `Appearance` tab under `Border style`:

- **Pill Shapes (Main Buttons, Search Bars, Badges)**: `100px` roundness.
- **Large Sections/Cards**: `32px` roundness.
- **Medium Cards (Reviews, Modals)**: `20px` roundness.
- **Input Fields & Small Action Buttons**: `12px` roundness.

## 4. Input Fields (Forms) - Detailed Breakdown

To make forms look modern and agency-grade, avoid standard grey borders. 

**Universal Input Style (Dark Mode / Navy Background)**:
- **Background style**: Flat Color -> `#FFFFFF` at **6% Opacity**.
- **Border style**: Solid, `1px`, color `#FFFFFF` at **10% Opacity**.
- **Roundness**: `12px`
- **Padding**: Top/Bottom `16px`, Left/Right `20px`.
- **Text**: Manrope, 16px, `#FFFFFF`.
- **Placeholder text**: `#FFFFFF` at 50% opacity.
- *Focus State (Conditional)*: Change border to `#00E0C4` at 50% opacity.

### Field-by-Field Breakdown:

**1. Full Name**
- **Input Type**: Text
- **Label**: `FULL NAME` (Manrope, 14px, Bold/600, `#FFFFFF` at 80% opacity, letter-spacing: 1px)
- **Placeholder**: `John Doe`

**2. Email Address**
- **Input Type**: Email
- **Label**: `EMAIL ADDRESS` 
- **Placeholder**: `john@example.com`

**3. Service Address**
- **Input Type**: Geographic Address (or standard Text)
- **Label**: `📍 SERVICE ADDRESS` (Use an icon next to the text)
- **Placeholder**: `123 Electric Ave, London`

**4. Preferred Time**
- **Input Type**: Dropdown
- **Label**: `⏱ PREFERRED TIME`
- **Choices**: 
  1. `As soon as possible`
  2. `Within the next few days`
  3. `Flexible`

**5. Job Description**
- **Input Type**: Multiline Input
- **Label**: `JOB DESCRIPTION`
- **Placeholder**: `What seems to be the problem? E.g., The consumer unit keeps tripping when I turn on the oven.`
- **Min Height**: `120px`

**6. Media Uploads (Add Photos & Voice Note)**
- These are styled differently than standard buttons to look like dropzones/uploaders.
- **Layout**: Two groups or buttons side-by-side.
- **Background**: `#FFFFFF` at **4% Opacity**.
- **Border style**: **Dashed**, `1px`, color `#FFFFFF` at **20% Opacity**.
- **Roundness**: `12px`
- **Text/Icon Color**: `#FFFFFF` (Text) and `#00E0C4` (Icon)
- **Hover Condition**: Change background to `#FFFFFF` at 10% opacity.

## 5. Replicating the "Liquid Glass" Effect

Bubble natively supports backdrop filters now, so you can achieve the exact same frosted glass look without custom CSS.

**For a Light Glass Card (on Cream background)**:
1. **Background Style**: Flat color.
2. **Color**: `#FFFFFF` set to **75% Opacity**.
3. **Backdrop Blur**: Check the box for "Apply backdrop filter" and set Blur to `24px`.
4. **Border**: Solid, `1px`, `#FFFFFF` at **80% Opacity**.
5. **Box Shadow**: 
   - Outset
   - Horizontal `0`, Vertical `8`, Blur `32`, Spread `0`
   - Color: `#1F2687` at **7% Opacity**.
6. **Roundness**: `32px`

**For a Dark Glass Card (on Navy background)**:
1. **Background Style**: Flat color.
2. **Color**: `#0B1D2C` set to **85% Opacity**.
3. **Backdrop Blur**: Check the box and set Blur to `24px`.
4. **Border**: Solid, `1px`, `#FFFFFF` at **15% Opacity**.
5. **Box Shadow**: 
   - Outset
   - Horizontal `0`, Vertical `10`, Blur `40`, Spread `0`
   - Color: `#000000` at **50% Opacity**.

## 6. Buttons & Hover Effects

**Primary CTA Button (Neon Cyan)**:
- **Background**: `#00E0C4`
- **Text**: Outfit, 700 (Bold), `16px` or `18px`, ALL CAPS. Color: `#0B1D2C`
- **Roundness**: `100px` (Pill shape)
- **Padding**: Vertical `16px`, Horizontal `32px`.
- **Hover Condition**: 
  - Change Background to `#33E8D2` (slightly brighter).
  - Add Box Shadow: Vertical `6`, Blur `24`, Color `#00E0C4` at **30% Opacity** (This creates the glowing torch effect).

## 7. Ambient Background Glow (Radial Gradient)

To achieve that premium "glowing" effect behind the form (the soft cyan spotlight you see at the top of the Quote page):

1. **Draw a Group** on your page and place it behind your main form/header (send to back).
2. **Size**: Width `600px`, Height `600px`.
3. **Position**: Center horizontally on the page, placed near the top (e.g., Y = `10%` or `-100px`).
4. **Background Style**: Gradient.
   - **Gradient Type**: Radial
   - **Center Color**: `#00E0C4` (Neon Cyan) at **15% Opacity**.
   - **Edge Color**: `#000000` (or your Deep Navy `#0B1D2C`) at **0% Opacity** (fully transparent).
5. **CRITICAL**: Check the box for **"Make element not clickable (ignore clicks)"** so it doesn't block users from clicking the inputs underneath it!

By copying these exact values into your Bubble Style Variables and Component properties, the Bubble app will perfectly match the Next.js landing page aesthetic.
