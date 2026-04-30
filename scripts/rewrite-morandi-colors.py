import sys

file_path = "src/app/expo/[id]/ranking/page.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# ── Update CARD_ACCENT_META swatches to match morandi palette ─────────────────
old_meta = """const CARD_ACCENT_META: Record<CardAccentId, { label: string; swatch: string }> = {
  amber:    { label: '琥珀', swatch: '#b89030' },
  rose:     { label: '玫紅', swatch: '#c04060' },
  sage:     { label: '松翠', swatch: '#2a8050' },
  indigo:   { label: '靛藍', swatch: '#4050b8' },
  lavender: { label: '薰紫', swatch: '#7060b8' },
  coral:    { label: '珊瑚', swatch: '#d04828' },
  sky:      { label: '天空', swatch: '#1888d0' },
  teal:     { label: '湖水', swatch: '#149090' },
  slate:    { label: '雪峰', swatch: '#5068a0' },
};"""

new_meta = """const CARD_ACCENT_META: Record<CardAccentId, { label: string; swatch: string }> = {
  amber:    { label: '橡木褐', swatch: '#9e7c48' },
  rose:     { label: '珊瑚粉', swatch: '#b87870' },
  sage:     { label: '銅綠', swatch: '#4a7860' },
  indigo:   { label: '霧藍', swatch: '#38708a' },
  lavender: { label: '薰煙紫', swatch: '#7868a8' },
  coral:    { label: '赭陶', swatch: '#9e6858' },
  sky:      { label: '麥穗', swatch: '#8a7050' },
  teal:     { label: '塵青', swatch: '#3a8080' },
  slate:    { label: '炭岩', swatch: '#5c6470' },
};"""

content = content.replace(old_meta, new_meta)

# ── Replace morandi block ──────────────────────────────────────────────────────
new_morandi = """  morandi: {
    amber: {
      exportBackground: '#e4d8c0',
      shellClassName: 'border-[#c8b898] bg-[linear-gradient(160deg,#f0e8d4_0%,#e4d8c0_100%)] shadow-[0_30px_80px_rgba(100,70,30,0.12)]',
      frameClassName: 'border-[#d4c8a8] bg-[#faf6ec] text-[#2a2010]',
      emptyClassName: 'border-[#c8b898] bg-[#e4d8c0] text-[#2a2010]',
      dividerClassName: 'border-[#d8ccb0]',
      eyebrowClassName: 'text-[#7a5a30]',
      titleClassName: 'text-[#2a2010]',
      modeChipClassName: 'border-[#d4c8a8] bg-[#ede8da]',
      modeLabelClassName: 'text-[#7a5a30]',
      modeValueClassName: 'text-[#2a2010]',
      tableHeaderClassName: 'text-[#7a5a30]',
      metaClassName: 'text-[#6a4e28]',
      valueClassName: 'text-[#3c2a14]',
      footerClassName: 'border-[#d8ccb0] text-[#7a5a30]',
      rowBaseClassName: 'border-[#d0c4a4]',
    },
    rose: {
      exportBackground: '#ecd8ce',
      shellClassName: 'border-[#d4b8b0] bg-[linear-gradient(160deg,#f6ece8_0%,#ead8d0_100%)] shadow-[0_30px_80px_rgba(140,80,70,0.10)]',
      frameClassName: 'border-[#dcc0b8] bg-[#fdf6f4] text-[#2a1818]',
      emptyClassName: 'border-[#d4b8b0] bg-[#ecd8ce] text-[#2a1818]',
      dividerClassName: 'border-[#dcc4bc]',
      eyebrowClassName: 'text-[#b07870]',
      titleClassName: 'text-[#2a1818]',
      modeChipClassName: 'border-[#dcc0b8] bg-[#ece0dc]',
      modeLabelClassName: 'text-[#b07870]',
      modeValueClassName: 'text-[#2a1818]',
      tableHeaderClassName: 'text-[#b07870]',
      metaClassName: 'text-[#906060]',
      valueClassName: 'text-[#3c2020]',
      footerClassName: 'border-[#dcc4bc] text-[#b07870]',
      rowBaseClassName: 'border-[#d4b8b0]',
    },
    sage: {
      exportBackground: '#c8d8c4',
      shellClassName: 'border-[#9ab4a4] bg-[linear-gradient(160deg,#dcecd8_0%,#c8dcc4_100%)] shadow-[0_30px_80px_rgba(50,100,80,0.10)]',
      frameClassName: 'border-[#a8c0b0] bg-[#f4faf4] text-[#102018]',
      emptyClassName: 'border-[#9ab4a4] bg-[#c8d8c4] text-[#102018]',
      dividerClassName: 'border-[#b0c8b8]',
      eyebrowClassName: 'text-[#4a7860]',
      titleClassName: 'text-[#102018]',
      modeChipClassName: 'border-[#a8c0b0] bg-[#d0e8d8]',
      modeLabelClassName: 'text-[#4a7860]',
      modeValueClassName: 'text-[#102018]',
      tableHeaderClassName: 'text-[#4a7860]',
      metaClassName: 'text-[#386850]',
      valueClassName: 'text-[#182a20]',
      footerClassName: 'border-[#b0c8b8] text-[#4a7860]',
      rowBaseClassName: 'border-[#a0bcac]',
    },
    indigo: {
      exportBackground: '#c4d4e4',
      shellClassName: 'border-[#98b4cc] bg-[linear-gradient(160deg,#d8e8f4_0%,#c4d4e8_100%)] shadow-[0_30px_80px_rgba(40,80,130,0.10)]',
      frameClassName: 'border-[#a4bcd0] bg-[#f4f8fc] text-[#0e1828]',
      emptyClassName: 'border-[#98b4cc] bg-[#c4d4e4] text-[#0e1828]',
      dividerClassName: 'border-[#a8c4d4]',
      eyebrowClassName: 'text-[#38708a]',
      titleClassName: 'text-[#0e1828]',
      modeChipClassName: 'border-[#a4bcd0] bg-[#d0e4f0]',
      modeLabelClassName: 'text-[#38708a]',
      modeValueClassName: 'text-[#0e1828]',
      tableHeaderClassName: 'text-[#38708a]',
      metaClassName: 'text-[#286080]',
      valueClassName: 'text-[#141e2c]',
      footerClassName: 'border-[#a8c4d4] text-[#38708a]',
      rowBaseClassName: 'border-[#a0b8c8]',
    },
    lavender: {
      exportBackground: '#d4cce0',
      shellClassName: 'border-[#b0a8c4] bg-[linear-gradient(160deg,#e4dff0_0%,#d8d0e8_100%)] shadow-[0_30px_80px_rgba(90,70,140,0.10)]',
      frameClassName: 'border-[#bcb4d0] bg-[#f8f6fc] text-[#1c1830]',
      emptyClassName: 'border-[#b0a8c4] bg-[#d4cce0] text-[#1c1830]',
      dividerClassName: 'border-[#c4bcd4]',
      eyebrowClassName: 'text-[#7868a8]',
      titleClassName: 'text-[#1c1830]',
      modeChipClassName: 'border-[#bcb4d0] bg-[#e4dff0]',
      modeLabelClassName: 'text-[#7868a8]',
      modeValueClassName: 'text-[#1c1830]',
      tableHeaderClassName: 'text-[#7868a8]',
      metaClassName: 'text-[#605890]',
      valueClassName: 'text-[#282040]',
      footerClassName: 'border-[#c4bcd4] text-[#7868a8]',
      rowBaseClassName: 'border-[#b8b0cc]',
    },
    coral: {
      exportBackground: '#dcc0b4',
      shellClassName: 'border-[#c8a090] bg-[linear-gradient(160deg,#ecdad0_0%,#e0cac0_100%)] shadow-[0_30px_80px_rgba(140,80,60,0.10)]',
      frameClassName: 'border-[#d4b0a0] bg-[#faf4f0] text-[#2c1810]',
      emptyClassName: 'border-[#c8a090] bg-[#dcc0b4] text-[#2c1810]',
      dividerClassName: 'border-[#d4b4a4]',
      eyebrowClassName: 'text-[#9e6858]',
      titleClassName: 'text-[#2c1810]',
      modeChipClassName: 'border-[#d4b0a0] bg-[#ecddd4]',
      modeLabelClassName: 'text-[#9e6858]',
      modeValueClassName: 'text-[#2c1810]',
      tableHeaderClassName: 'text-[#9e6858]',
      metaClassName: 'text-[#865048]',
      valueClassName: 'text-[#3c2018]',
      footerClassName: 'border-[#d4b4a4] text-[#9e6858]',
      rowBaseClassName: 'border-[#cca898]',
    },
    sky: {
      exportBackground: '#ece4d0',
      shellClassName: 'border-[#d4c8a8] bg-[linear-gradient(160deg,#f4eed8_0%,#ece4cc_100%)] shadow-[0_30px_80px_rgba(100,80,40,0.10)]',
      frameClassName: 'border-[#dcd0b0] bg-[#fefaf0] text-[#281e10]',
      emptyClassName: 'border-[#d4c8a8] bg-[#ece4d0] text-[#281e10]',
      dividerClassName: 'border-[#dcd4b4]',
      eyebrowClassName: 'text-[#8a7050]',
      titleClassName: 'text-[#281e10]',
      modeChipClassName: 'border-[#dcd0b0] bg-[#ece8d4]',
      modeLabelClassName: 'text-[#8a7050]',
      modeValueClassName: 'text-[#281e10]',
      tableHeaderClassName: 'text-[#8a7050]',
      metaClassName: 'text-[#706040]',
      valueClassName: 'text-[#342818]',
      footerClassName: 'border-[#dcd4b4] text-[#8a7050]',
      rowBaseClassName: 'border-[#d4cca8]',
    },
    teal: {
      exportBackground: '#b8d0d0',
      shellClassName: 'border-[#88b4b4] bg-[linear-gradient(160deg,#cce4e4_0%,#b8d0d0_100%)] shadow-[0_30px_80px_rgba(30,100,100,0.10)]',
      frameClassName: 'border-[#98c0c0] bg-[#f0f8f8] text-[#081c1c]',
      emptyClassName: 'border-[#88b4b4] bg-[#b8d0d0] text-[#081c1c]',
      dividerClassName: 'border-[#a0c8c8]',
      eyebrowClassName: 'text-[#3a8080]',
      titleClassName: 'text-[#081c1c]',
      modeChipClassName: 'border-[#98c0c0] bg-[#c8e4e4]',
      modeLabelClassName: 'text-[#3a8080]',
      modeValueClassName: 'text-[#081c1c]',
      tableHeaderClassName: 'text-[#3a8080]',
      metaClassName: 'text-[#286868]',
      valueClassName: 'text-[#102828]',
      footerClassName: 'border-[#a0c8c8] text-[#3a8080]',
      rowBaseClassName: 'border-[#94bcbc]',
    },
    slate: {
      exportBackground: '#4a5060',
      shellClassName: 'border-[#5c6470] bg-[linear-gradient(160deg,#606870_0%,#4a5060_100%)] shadow-[0_30px_80px_rgba(10,15,25,0.30)]',
      frameClassName: 'border-[#545c68] bg-[#3c4450] text-[#e0e4ec]',
      emptyClassName: 'border-[#5c6470] bg-[#484e5a] text-[#e0e4ec]',
      dividerClassName: 'border-[#505860]',
      eyebrowClassName: 'text-[#9098b0]',
      titleClassName: 'text-[#e8ecf4]',
      modeChipClassName: 'border-[#545c68] bg-[#404858]',
      modeLabelClassName: 'text-[#9098b0]',
      modeValueClassName: 'text-[#e8ecf4]',
      tableHeaderClassName: 'text-[#8090a8]',
      metaClassName: 'text-[#7080a0]',
      valueClassName: 'text-[#d8dce8]',
      footerClassName: 'border-[#505860] text-[#8090a8]',
      rowBaseClassName: 'border-[#505c68]',
    },
  },"""

morandi_start = content.find("  morandi: {")
dark_start = content.find("  dark: {", morandi_start)

if morandi_start == -1 or dark_start == -1:
    print(f"ERROR morandi_start={morandi_start} dark_start={dark_start}")
    sys.exit(1)

content = content[:morandi_start] + new_morandi + "\n" + content[dark_start:]

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Done!")
