import sys

file_path = "src/app/expo/[id]/ranking/page.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# ── 1. Type ────────────────────────────────────────────────────────────────────
content = content.replace(
    "type CardMode = 'light' | 'vivid' | 'dark';",
    "type CardMode = 'light' | 'morandi' | 'dark';"
)

# ── 2. Mode key in state / array ───────────────────────────────────────────────
content = content.replace(
    "(['light', 'vivid', 'dark'] as const)",
    "(['light', 'morandi', 'dark'] as const)"
)

# ── 3. Button label ────────────────────────────────────────────────────────────
content = content.replace(
    "mode === 'vivid' ? '◆ 鮮艷'",
    "mode === 'morandi' ? '◆ 莫蘭迪'"
)

# ── 4. Medal style — morandi is light-based, treat same as light ───────────────
content = content.replace(
    "getRankMedalStyle(rank, cardMode !== 'light', currentShareCardTheme.rowBaseClassName)",
    "getRankMedalStyle(rank, cardMode === 'dark', currentShareCardTheme.rowBaseClassName)"
)

# ── 5. CARD_THEMES vivid block → morandi ──────────────────────────────────────
morandi_themes = """  morandi: {
    amber: {
      exportBackground: '#f0e8d8',
      shellClassName: 'border-[#c8b898] bg-[linear-gradient(160deg,#f5ede0_0%,#e8dcc8_100%)] shadow-[0_30px_80px_rgba(120,90,40,0.12)]',
      frameClassName: 'border-[#d4c4a0] bg-[#faf5ec] text-[#2e2010]',
      emptyClassName: 'border-[#c8b898] bg-[#f0e8d8] text-[#2e2010]',
      dividerClassName: 'border-[#d8c8a8]',
      eyebrowClassName: 'text-[#7a5c30]',
      titleClassName: 'text-[#2e2010]',
      modeChipClassName: 'border-[#d4c4a0] bg-[#ede4d4]',
      modeLabelClassName: 'text-[#7a5c30]',
      modeValueClassName: 'text-[#2e2010]',
      tableHeaderClassName: 'text-[#7a5c30]',
      metaClassName: 'text-[#6a4e28]',
      valueClassName: 'text-[#3c2a14]',
      footerClassName: 'border-[#d8c8a8] text-[#7a5c30]',
      rowBaseClassName: 'border-[#d0c0a0]',
    },
    rose: {
      exportBackground: '#eee0dc',
      shellClassName: 'border-[#cdb0aa] bg-[linear-gradient(160deg,#f4e8e4_0%,#e8d8d4_100%)] shadow-[0_30px_80px_rgba(140,80,80,0.10)]',
      frameClassName: 'border-[#d4b8b2] bg-[#faf4f2] text-[#2c1414]',
      emptyClassName: 'border-[#cdb0aa] bg-[#eee0dc] text-[#2c1414]',
      dividerClassName: 'border-[#d8bcb8]',
      eyebrowClassName: 'text-[#885858]',
      titleClassName: 'text-[#2c1414]',
      modeChipClassName: 'border-[#d4b8b2] bg-[#ece0dc]',
      modeLabelClassName: 'text-[#885858]',
      modeValueClassName: 'text-[#2c1414]',
      tableHeaderClassName: 'text-[#885858]',
      metaClassName: 'text-[#784848]',
      valueClassName: 'text-[#3a1c1c]',
      footerClassName: 'border-[#d8bcb8] text-[#885858]',
      rowBaseClassName: 'border-[#d0b0ac]',
    },
    sage: {
      exportBackground: '#dce6d8',
      shellClassName: 'border-[#a8bcac] bg-[linear-gradient(160deg,#e8f0e4_0%,#d8e4d4_100%)] shadow-[0_30px_80px_rgba(60,100,60,0.10)]',
      frameClassName: 'border-[#b4c8b8] bg-[#f4f8f4] text-[#102010]',
      emptyClassName: 'border-[#a8bcac] bg-[#dce6d8] text-[#102010]',
      dividerClassName: 'border-[#b8ccbc]',
      eyebrowClassName: 'text-[#4e7050]',
      titleClassName: 'text-[#102010]',
      modeChipClassName: 'border-[#b4c8b8] bg-[#dce8de]',
      modeLabelClassName: 'text-[#4e7050]',
      modeValueClassName: 'text-[#102010]',
      tableHeaderClassName: 'text-[#4e7050]',
      metaClassName: 'text-[#3e5e40]',
      valueClassName: 'text-[#1a2e1a]',
      footerClassName: 'border-[#b8ccbc] text-[#4e7050]',
      rowBaseClassName: 'border-[#b0c4b4]',
    },
    indigo: {
      exportBackground: '#d8e4ee',
      shellClassName: 'border-[#a0b4c8] bg-[linear-gradient(160deg,#e4eef8_0%,#d4e2ee_100%)] shadow-[0_30px_80px_rgba(60,90,130,0.10)]',
      frameClassName: 'border-[#aabcd0] bg-[#f2f7fc] text-[#0e1828]',
      emptyClassName: 'border-[#a0b4c8] bg-[#d8e4ee] text-[#0e1828]',
      dividerClassName: 'border-[#b0c4d4]',
      eyebrowClassName: 'text-[#406090]',
      titleClassName: 'text-[#0e1828]',
      modeChipClassName: 'border-[#aabcd0] bg-[#d8e6f0]',
      modeLabelClassName: 'text-[#406090]',
      modeValueClassName: 'text-[#0e1828]',
      tableHeaderClassName: 'text-[#406090]',
      metaClassName: 'text-[#305080]',
      valueClassName: 'text-[#182030]',
      footerClassName: 'border-[#b0c4d4] text-[#406090]',
      rowBaseClassName: 'border-[#a8bcc8]',
    },
    lavender: {
      exportBackground: '#e2daf0',
      shellClassName: 'border-[#b8b0d4] bg-[linear-gradient(160deg,#ece6f8_0%,#e0d8f0_100%)] shadow-[0_30px_80px_rgba(90,70,150,0.10)]',
      frameClassName: 'border-[#c0b8d8] bg-[#f6f4fc] text-[#1c1430]',
      emptyClassName: 'border-[#b8b0d4] bg-[#e2daf0] text-[#1c1430]',
      dividerClassName: 'border-[#c4bcdc]',
      eyebrowClassName: 'text-[#6858a0]',
      titleClassName: 'text-[#1c1430]',
      modeChipClassName: 'border-[#c0b8d8] bg-[#e4dff4]',
      modeLabelClassName: 'text-[#6858a0]',
      modeValueClassName: 'text-[#1c1430]',
      tableHeaderClassName: 'text-[#6858a0]',
      metaClassName: 'text-[#584890]',
      valueClassName: 'text-[#281e40]',
      footerClassName: 'border-[#c4bcdc] text-[#6858a0]',
      rowBaseClassName: 'border-[#bab2d0]',
    },
    coral: {
      exportBackground: '#eedcd4',
      shellClassName: 'border-[#c8a898] bg-[linear-gradient(160deg,#f4e8e0_0%,#e8d8cc_100%)] shadow-[0_30px_80px_rgba(150,80,60,0.10)]',
      frameClassName: 'border-[#d4b0a0] bg-[#faf4f0] text-[#2c1208]',
      emptyClassName: 'border-[#c8a898] bg-[#eedcd4] text-[#2c1208]',
      dividerClassName: 'border-[#d4b4a4]',
      eyebrowClassName: 'text-[#905848]',
      titleClassName: 'text-[#2c1208]',
      modeChipClassName: 'border-[#d4b0a0] bg-[#ecddd4]',
      modeLabelClassName: 'text-[#905848]',
      modeValueClassName: 'text-[#2c1208]',
      tableHeaderClassName: 'text-[#905848]',
      metaClassName: 'text-[#804838]',
      valueClassName: 'text-[#3c1e10]',
      footerClassName: 'border-[#d4b4a4] text-[#905848]',
      rowBaseClassName: 'border-[#c8a898]',
    },
    sky: {
      exportBackground: '#d4e4f0',
      shellClassName: 'border-[#9cbcd4] bg-[linear-gradient(160deg,#e4f0f8_0%,#d0e2f0_100%)] shadow-[0_30px_80px_rgba(40,100,160,0.10)]',
      frameClassName: 'border-[#a8c4d8] bg-[#f0f8fc] text-[#081420]',
      emptyClassName: 'border-[#9cbcd4] bg-[#d4e4f0] text-[#081420]',
      dividerClassName: 'border-[#aac8dc]',
      eyebrowClassName: 'text-[#2868a0]',
      titleClassName: 'text-[#081420]',
      modeChipClassName: 'border-[#a8c4d8] bg-[#d4e8f4]',
      modeLabelClassName: 'text-[#2868a0]',
      modeValueClassName: 'text-[#081420]',
      tableHeaderClassName: 'text-[#2868a0]',
      metaClassName: 'text-[#185888]',
      valueClassName: 'text-[#101e2c]',
      footerClassName: 'border-[#aac8dc] text-[#2868a0]',
      rowBaseClassName: 'border-[#a4bece]',
    },
    teal: {
      exportBackground: '#d4e8e4',
      shellClassName: 'border-[#94c0bc] bg-[linear-gradient(160deg,#e4f2f0_0%,#d0e8e4_100%)] shadow-[0_30px_80px_rgba(30,110,100,0.10)]',
      frameClassName: 'border-[#a0c8c4] bg-[#f0f9f8] text-[#081c18]',
      emptyClassName: 'border-[#94c0bc] bg-[#d4e8e4] text-[#081c18]',
      dividerClassName: 'border-[#a8ccC8]',
      eyebrowClassName: 'text-[#287878]',
      titleClassName: 'text-[#081c18]',
      modeChipClassName: 'border-[#a0c8c4] bg-[#d4ecea]',
      modeLabelClassName: 'text-[#287878]',
      modeValueClassName: 'text-[#081c18]',
      tableHeaderClassName: 'text-[#287878]',
      metaClassName: 'text-[#206060]',
      valueClassName: 'text-[#102820]',
      footerClassName: 'border-[#a8ccc8] text-[#287878]',
      rowBaseClassName: 'border-[#9cbebe]',
    },
    slate: {
      exportBackground: '#dcdee8',
      shellClassName: 'border-[#a8aec4] bg-[linear-gradient(160deg,#e8eaf2_0%,#dcdfe8_100%)] shadow-[0_30px_80px_rgba(70,80,120,0.10)]',
      frameClassName: 'border-[#b0b8cc] bg-[#f4f5f8] text-[#10121e]',
      emptyClassName: 'border-[#a8aec4] bg-[#dcdee8] text-[#10121e]',
      dividerClassName: 'border-[#b8bece]',
      eyebrowClassName: 'text-[#505878]',
      titleClassName: 'text-[#10121e]',
      modeChipClassName: 'border-[#b0b8cc] bg-[#dce0ec]',
      modeLabelClassName: 'text-[#505878]',
      modeValueClassName: 'text-[#10121e]',
      tableHeaderClassName: 'text-[#505878]',
      metaClassName: 'text-[#404860]',
      valueClassName: 'text-[#1c2030]',
      footerClassName: 'border-[#b8bece] text-[#505878]',
      rowBaseClassName: 'border-[#aab0c4]',
    },
  },"""

# Find vivid block start/end and replace
vivid_start = content.find("  vivid: {")
if vivid_start == -1:
    print("ERROR: vivid block not found")
    sys.exit(1)

# Find the next top-level mode after vivid (  dark: {)
dark_start = content.find("  dark: {", vivid_start)
if dark_start == -1:
    print("ERROR: dark block not found after vivid")
    sys.exit(1)

content = content[:vivid_start] + morandi_themes + "\n" + content[dark_start:]

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Done! vivid → morandi themes applied.")
