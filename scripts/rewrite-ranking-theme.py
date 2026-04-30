#!/usr/bin/env python3
"""Rewrites the ranking page theme system from preset-only to mode+accent customizable."""
import re

FILE = 'src/app/expo/[id]/ranking/page.tsx'

with open(FILE, 'r') as f:
    content = f.read()

# ──────────────────────────────────────────────────────────────
# STEP 1: Replace ShareCardThemeId type line
# ──────────────────────────────────────────────────────────────
content = content.replace(
    "type ShareCardThemeId = 'plum-light' | 'moss-light' | 'midnight-dark' | 'charcoal-dark';",
    "type CardMode = 'light' | 'dark';\ntype CardAccentId = 'amber' | 'rose' | 'sage' | 'indigo' | 'lavender';",
    1
)

# ──────────────────────────────────────────────────────────────
# STEP 2: Replace the SHARE_CARD_THEMES block with new CARD_THEMES
# We'll find it by its unique start and end markers.
# ──────────────────────────────────────────────────────────────
start_marker = "const SHARE_CARD_THEMES: Record<ShareCardThemeId, {"
# Find the matching closing `};` by counting braces
idx_start = content.find(start_marker)
assert idx_start >= 0, "Could not find SHARE_CARD_THEMES start"

# Walk forward to find the matching top-level close
depth = 0
idx_end = idx_start
for i in range(idx_start, len(content)):
    if content[i] == '{':
        depth += 1
    elif content[i] == '}':
        depth -= 1
        if depth == 0:
            # Consume the trailing `;` and newline
            idx_end = i + 1
            if content[idx_end:idx_end+2] == ';\n':
                idx_end += 2
            elif content[idx_end] == ';':
                idx_end += 1
            break

NEW_DATA = '''
const CARD_ACCENT_META: Record<CardAccentId, { label: string; swatch: string }> = {
  amber:    { label: '琥珀', swatch: '#b89030' },
  rose:     { label: '玫紅', swatch: '#c04060' },
  sage:     { label: '松翠', swatch: '#2a8050' },
  indigo:   { label: '靛藍', swatch: '#4050b8' },
  lavender: { label: '薰紫', swatch: '#7060b8' },
};

type CardThemeShape = {
  exportBackground: string;
  shellClassName: string;
  frameClassName: string;
  emptyClassName: string;
  dividerClassName: string;
  eyebrowClassName: string;
  titleClassName: string;
  modeChipClassName: string;
  modeLabelClassName: string;
  modeValueClassName: string;
  tableHeaderClassName: string;
  metaClassName: string;
  valueClassName: string;
  footerClassName: string;
  rowBaseClassName: string;
};

const CARD_THEMES: Record<CardMode, Record<CardAccentId, CardThemeShape>> = {
  light: {
    amber: {
      exportBackground: '#f5eedf',
      shellClassName: 'border-[#d8c49a] bg-[linear-gradient(160deg,#faf4e6_0%,#ede0c4_100%)] shadow-[0_30px_80px_rgba(160,120,40,0.14)]',
      frameClassName: 'border-[#e0ccaa] bg-[#fdf9ee] text-[#2a1e08]',
      emptyClassName: 'border-[#d8c49a] bg-[#f5eedf] text-[#2a1e08]',
      dividerClassName: 'border-[#e4d0a8]',
      eyebrowClassName: 'text-[#a07828]',
      titleClassName: 'text-[#2a1e08]',
      modeChipClassName: 'border-[#e0ccaa] bg-[#f5eedc]',
      modeLabelClassName: 'text-[#a07828]',
      modeValueClassName: 'text-[#2a1e08]',
      tableHeaderClassName: 'text-[#a07828]',
      metaClassName: 'text-[#7a5820]',
      valueClassName: 'text-[#3e2c10]',
      footerClassName: 'border-[#e4d0a8] text-[#a07828]',
      rowBaseClassName: 'border-[#dcc8a0]',
    },
    rose: {
      exportBackground: '#f8edf0',
      shellClassName: 'border-[#e8b8c4] bg-[linear-gradient(160deg,#fdf0f4_0%,#f0dae0_100%)] shadow-[0_30px_80px_rgba(180,60,80,0.10)]',
      frameClassName: 'border-[#e0b0be] bg-[#fdf6f8] text-[#2a1018]',
      emptyClassName: 'border-[#e8b8c4] bg-[#f8edf0] text-[#2a1018]',
      dividerClassName: 'border-[#e8c0cc]',
      eyebrowClassName: 'text-[#b04060]',
      titleClassName: 'text-[#2a1018]',
      modeChipClassName: 'border-[#e0b0be] bg-[#fce8f0]',
      modeLabelClassName: 'text-[#b04060]',
      modeValueClassName: 'text-[#2a1018]',
      tableHeaderClassName: 'text-[#b04060]',
      metaClassName: 'text-[#8a3050]',
      valueClassName: 'text-[#3a1828]',
      footerClassName: 'border-[#e8c0cc] text-[#b04060]',
      rowBaseClassName: 'border-[#e0b8c4]',
    },
    sage: {
      exportBackground: '#edf5f0',
      shellClassName: 'border-[#a8d0b8] bg-[linear-gradient(160deg,#f0f8f4_0%,#ddeee6_100%)] shadow-[0_30px_80px_rgba(40,120,70,0.10)]',
      frameClassName: 'border-[#b0d4c0] bg-[#f6fcf8] text-[#0e2818]',
      emptyClassName: 'border-[#a8d0b8] bg-[#edf5f0] text-[#0e2818]',
      dividerClassName: 'border-[#b8d8c4]',
      eyebrowClassName: 'text-[#2a8050]',
      titleClassName: 'text-[#0e2818]',
      modeChipClassName: 'border-[#b0d4c0] bg-[#e8f4ec]',
      modeLabelClassName: 'text-[#2a8050]',
      modeValueClassName: 'text-[#0e2818]',
      tableHeaderClassName: 'text-[#2a8050]',
      metaClassName: 'text-[#286040]',
      valueClassName: 'text-[#183020]',
      footerClassName: 'border-[#b8d8c4] text-[#2a8050]',
      rowBaseClassName: 'border-[#b0d0bc]',
    },
    indigo: {
      exportBackground: '#eeeef8',
      shellClassName: 'border-[#b8b8e8] bg-[linear-gradient(160deg,#f2f2fc_0%,#e0e0f4_100%)] shadow-[0_30px_80px_rgba(60,70,180,0.10)]',
      frameClassName: 'border-[#c0c0ea] bg-[#f8f8fe] text-[#14142a]',
      emptyClassName: 'border-[#b8b8e8] bg-[#eeeef8] text-[#14142a]',
      dividerClassName: 'border-[#c8c8ec]',
      eyebrowClassName: 'text-[#4050b8]',
      titleClassName: 'text-[#14142a]',
      modeChipClassName: 'border-[#c0c0ea] bg-[#eaeafc]',
      modeLabelClassName: 'text-[#4050b8]',
      modeValueClassName: 'text-[#14142a]',
      tableHeaderClassName: 'text-[#4050b8]',
      metaClassName: 'text-[#404090]',
      valueClassName: 'text-[#20203c]',
      footerClassName: 'border-[#c8c8ec] text-[#4050b8]',
      rowBaseClassName: 'border-[#c0c0e8]',
    },
    lavender: {
      exportBackground: '#ede8f5',
      shellClassName: 'border-[#cfc3e8] bg-[linear-gradient(160deg,#f0ecf8_0%,#e4daf2_100%)] shadow-[0_30px_80px_rgba(100,70,160,0.12)]',
      frameClassName: 'border-[#d8ccec] bg-[#faf8fd] text-[#1e1530]',
      emptyClassName: 'border-[#cfc3e8] bg-[#f2eef8] text-[#1e1530]',
      dividerClassName: 'border-[#ddd4f0]',
      eyebrowClassName: 'text-[#7060b8]',
      titleClassName: 'text-[#1e1530]',
      modeChipClassName: 'border-[#d8ccec] bg-[#f0eaf8]',
      modeLabelClassName: 'text-[#7060b8]',
      modeValueClassName: 'text-[#1e1530]',
      tableHeaderClassName: 'text-[#7060b8]',
      metaClassName: 'text-[#5e4890]',
      valueClassName: 'text-[#2e2050]',
      footerClassName: 'border-[#ddd4f0] text-[#7060b8]',
      rowBaseClassName: 'border-[#d4c8e8]',
    },
  },
  dark: {
    amber: {
      exportBackground: '#131316',
      shellClassName: 'border-[#2a2a32] bg-[linear-gradient(160deg,#1c1c22_0%,#0e0e12_100%)] shadow-[0_30px_80px_rgba(0,0,0,0.36)]',
      frameClassName: 'border-[#252529] bg-[#161618] text-[#f0ece4]',
      emptyClassName: 'border-[#2e2e34] bg-[#1a1a1e] text-[#f0ece4]',
      dividerClassName: 'border-[#252529]',
      eyebrowClassName: 'text-[#b5985a]',
      titleClassName: 'text-[#f8f5ee]',
      modeChipClassName: 'border-[#2e2e36] bg-[#202024]',
      modeLabelClassName: 'text-[#b5985a]',
      modeValueClassName: 'text-[#f8f5ee]',
      tableHeaderClassName: 'text-[#a8904e]',
      metaClassName: 'text-[#9e8862]',
      valueClassName: 'text-[#ede5d4]',
      footerClassName: 'border-[#252529] text-[#a8904e]',
      rowBaseClassName: 'border-[#2e2e36]',
    },
    rose: {
      exportBackground: '#12080e',
      shellClassName: 'border-[#2e1020] bg-[linear-gradient(160deg,#1e0c18_0%,#0e0610_100%)] shadow-[0_30px_80px_rgba(0,0,0,0.40)]',
      frameClassName: 'border-[#281018] bg-[#130810] text-[#f0e0e8]',
      emptyClassName: 'border-[#2e1020] bg-[#1a0c14] text-[#f0e0e8]',
      dividerClassName: 'border-[#2a1020]',
      eyebrowClassName: 'text-[#d47090]',
      titleClassName: 'text-[#f8eaee]',
      modeChipClassName: 'border-[#2e1020] bg-[#160a10]',
      modeLabelClassName: 'text-[#d47090]',
      modeValueClassName: 'text-[#f8eaee]',
      tableHeaderClassName: 'text-[#c45878]',
      metaClassName: 'text-[#c08090]',
      valueClassName: 'text-[#f0d8e0]',
      footerClassName: 'border-[#2a1020] text-[#c45878]',
      rowBaseClassName: 'border-[#2e1020]',
    },
    sage: {
      exportBackground: '#060e08',
      shellClassName: 'border-[#142810] bg-[linear-gradient(160deg,#0c1c0a_0%,#050e04_100%)] shadow-[0_30px_80px_rgba(0,0,0,0.40)]',
      frameClassName: 'border-[#162c10] bg-[#091408] text-[#d8f0d8]',
      emptyClassName: 'border-[#142810] bg-[#0c1a08] text-[#d8f0d8]',
      dividerClassName: 'border-[#162c10]',
      eyebrowClassName: 'text-[#48c058]',
      titleClassName: 'text-[#e6f8e6]',
      modeChipClassName: 'border-[#182e10] bg-[#0c1c08]',
      modeLabelClassName: 'text-[#48c058]',
      modeValueClassName: 'text-[#e6f8e6]',
      tableHeaderClassName: 'text-[#40b050]',
      metaClassName: 'text-[#508850]',
      valueClassName: 'text-[#c8ecc8]',
      footerClassName: 'border-[#162c10] text-[#40b050]',
      rowBaseClassName: 'border-[#1a2e12]',
    },
    indigo: {
      exportBackground: '#080810',
      shellClassName: 'border-[#1c1c38] bg-[linear-gradient(160deg,#12122a_0%,#080812_100%)] shadow-[0_30px_80px_rgba(0,0,0,0.40)]',
      frameClassName: 'border-[#1e1e34] bg-[#0e0e20] text-[#e0e0f8]',
      emptyClassName: 'border-[#1c1c38] bg-[#121224] text-[#e0e0f8]',
      dividerClassName: 'border-[#1e1e36]',
      eyebrowClassName: 'text-[#7080e0]',
      titleClassName: 'text-[#f0f0fc]',
      modeChipClassName: 'border-[#201e38] bg-[#121228]',
      modeLabelClassName: 'text-[#7080e0]',
      modeValueClassName: 'text-[#f0f0fc]',
      tableHeaderClassName: 'text-[#6878d8]',
      metaClassName: 'text-[#6070b0]',
      valueClassName: 'text-[#d8d8f4]',
      footerClassName: 'border-[#1e1e36] text-[#6878d8]',
      rowBaseClassName: 'border-[#201e38]',
    },
    lavender: {
      exportBackground: '#0a080e',
      shellClassName: 'border-[#281438] bg-[linear-gradient(160deg,#180c24_0%,#0a0610_100%)] shadow-[0_30px_80px_rgba(0,0,0,0.40)]',
      frameClassName: 'border-[#241030] bg-[#110820] text-[#ecd8f8]',
      emptyClassName: 'border-[#281438] bg-[#160c20] text-[#ecd8f8]',
      dividerClassName: 'border-[#261238]',
      eyebrowClassName: 'text-[#c070f0]',
      titleClassName: 'text-[#f6ecfc]',
      modeChipClassName: 'border-[#281438] bg-[#160c24]',
      modeLabelClassName: 'text-[#c070f0]',
      modeValueClassName: 'text-[#f6ecfc]',
      tableHeaderClassName: 'text-[#b860e0]',
      metaClassName: 'text-[#9060b0]',
      valueClassName: 'text-[#e8d4f8]',
      footerClassName: 'border-[#261238] text-[#b860e0]',
      rowBaseClassName: 'border-[#281438]',
    },
  },
};
'''

content = content[:idx_start] + NEW_DATA + content[idx_end:]

# ──────────────────────────────────────────────────────────────
# STEP 3: Replace getRankMedalStyle function
# ──────────────────────────────────────────────────────────────
old_medal_start = "function getRankMedalStyle(rank: number, themeId: ShareCardThemeId) {"
old_medal_end_after = "}\n"  # single close brace + newline at top level

idx_medal = content.find(old_medal_start)
assert idx_medal >= 0, "Could not find getRankMedalStyle"

# Walk to find matching close
depth = 0
i = idx_medal
while i < len(content):
    if content[i] == '{':
        depth += 1
    elif content[i] == '}':
        depth -= 1
        if depth == 0:
            idx_medal_end = i + 1
            if content[idx_medal_end] == '\n':
                idx_medal_end += 1
            break
    i += 1

NEW_MEDAL = '''function getRankMedalStyle(rank: number, isDark: boolean, rowBaseClassName: string) {
  if (isDark) {
    if (rank === 1) return {
      rowClassName: 'border-[#484230] bg-[#1e1c10]',
      rankClassName: 'border-[#c4a040] bg-[#deba48] text-[#181408]',
    };
    if (rank === 2) return {
      rowClassName: 'border-[#38383e] bg-[#1a1a20]',
      rankClassName: 'border-[#8890a0] bg-[#c8ccd8] text-[#14141e]',
    };
    if (rank === 3) return {
      rowClassName: 'border-[#483020] bg-[#1c1410]',
      rankClassName: 'border-[#b87848] bg-[#cc9464] text-[#1c1008]',
    };
    return {
      rowClassName: rowBaseClassName,
      rankClassName: 'border-[#3a3a42] bg-[#242428] text-[#d4ccb8]',
    };
  }
  if (rank === 1) return {
    rowClassName: 'border-[#c8a840]/50 bg-[#fdf5d8]',
    rankClassName: 'border-[#b89030] bg-[#d4a840] text-[#241800]',
  };
  if (rank === 2) return {
    rowClassName: 'border-[#b0b0b0]/50 bg-[#f5f5f5]',
    rankClassName: 'border-[#909090] bg-[#c8c8c8] text-[#202020]',
  };
  if (rank === 3) return {
    rowClassName: 'border-[#d4a870]/45 bg-[#f8f0e4]',
    rankClassName: 'border-[#b47840] bg-[#d09060] text-[#2a1808]',
  };
  return {
    rowClassName: rowBaseClassName,
    rankClassName: 'border-[#c0b898] bg-[#ece4cc] text-[#4a3c20]',
  };
}
'''

content = content[:idx_medal] + NEW_MEDAL + content[idx_medal_end:]

# ──────────────────────────────────────────────────────────────
# STEP 4: Replace shareCardTheme state declaration
# ──────────────────────────────────────────────────────────────
content = content.replace(
    "  const [shareCardTheme, setShareCardTheme] = useState<ShareCardThemeId>('plum-light');",
    "  const [cardMode, setCardMode] = useState<CardMode>('light');\n  const [cardAccent, setCardAccent] = useState<CardAccentId>('amber');",
    1
)

# ──────────────────────────────────────────────────────────────
# STEP 5: Replace currentShareCardTheme derivation
# ──────────────────────────────────────────────────────────────
content = content.replace(
    "  const currentShareCardTheme = SHARE_CARD_THEMES[shareCardTheme];",
    "  const currentShareCardTheme = CARD_THEMES[cardMode][cardAccent];",
    1
)

# ──────────────────────────────────────────────────────────────
# STEP 6: Replace getRankMedalStyle call in card rendering
# ──────────────────────────────────────────────────────────────
content = content.replace(
    "const medalStyle = getRankMedalStyle(rank, shareCardTheme);",
    "const medalStyle = getRankMedalStyle(rank, cardMode === 'dark', currentShareCardTheme.rowBaseClassName);",
    1
)

# ──────────────────────────────────────────────────────────────
# STEP 7: Replace the 配色 UI section
# ──────────────────────────────────────────────────────────────
old_ui_start = '            {/* 配色 */}'
old_ui_end_after = '            </div>\n'  # closing </div> of the section

idx_ui = content.find(old_ui_start)
assert idx_ui >= 0, "Could not find 配色 section"

# Find the closing </div> after the section (at the same indent level)
# The section ends with `            </div>` (12 spaces) followed by newline
# followed by `          </div>` (10 spaces, the outer panel)
# We look for the `            </div>` that closes this section

i = idx_ui
depth = 0
in_jsx = False
# Simple approach: just find the next `            </div>\n` that brings depth to 0
while i < len(content):
    if content[i:i+5] == '<div ':
        depth += 1
    elif content[i:i+6] == '<div\n':
        depth += 1
    elif content[i:i+12] == '            ':
        if content[i+12:i+18] == '<div ':
            depth += 1
        elif content[i+12:i+18] == '</div>':
            if depth == 0:
                idx_ui_end = i + 12 + 6  # past `            </div>`
                if content[idx_ui_end] == '\n':
                    idx_ui_end += 1
                break
            depth -= 1
    i += 1

# Simpler: use regex to find the section
import re
# Find from old_ui_start to the next line that is just '            </div>'
pattern = re.escape(old_ui_start) + r'.*?(?=\n            </div>\n          </div>)'
m = re.search(pattern, content, re.DOTALL)
if m:
    idx_ui = m.start()
    idx_ui_end = m.end()
    # We stop just before the closing `            </div>`, which belongs to the outer panel
    # But we need to also consume the closing div of THIS section
    # The section div itself ends with `            </div>`
    # Let's find it by looking for `            </div>\n` after the end of our match
    after = content[idx_ui_end:]
    close_div = '\n            </div>\n'
    close_idx = after.find(close_div)
    if close_idx >= 0:
        idx_ui_end = idx_ui_end + close_idx + len(close_div)

NEW_UI = '''            {/* 配色 */}
            <div className="mt-3 border-t border-white/10 pt-3">
              <p className="mb-2 text-[7px] font-bold uppercase tracking-[0.14em] text-[#ffcf99]/45">卡片配色</p>
              {/* 底色模式 */}
              <div className="grid grid-cols-2 gap-1 mb-2">
                {(['light', 'dark'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setCardMode(mode)}
                    className={cn(
                      'rounded-[0.85rem] border py-2 text-center transition-all',
                      cardMode === mode
                        ? 'border-[#ffd166] bg-[#ffd166]/12 shadow-[0_0_0_1.5px_rgba(255,209,102,0.28)]'
                        : 'border-white/15 bg-white/5 hover:bg-white/10'
                    )}
                  >
                    <p className="text-[9px] font-bold text-[#fff4e5]">{mode === 'light' ? '☀ 淺底' : '● 深底'}</p>
                  </button>
                ))}
              </div>
              {/* 強調色 */}
              <div className="flex items-center gap-2">
                {(Object.entries(CARD_ACCENT_META) as Array<[CardAccentId, { label: string; swatch: string }]>).map(([accentId, meta]) => (
                  <button
                    key={accentId}
                    type="button"
                    title={meta.label}
                    onClick={() => setCardAccent(accentId)}
                    style={{ backgroundColor: meta.swatch }}
                    className={cn(
                      'flex-1 rounded-full border transition-all',
                      'aspect-square',
                      cardAccent === accentId
                        ? 'border-[#ffd166] shadow-[0_0_0_2px_rgba(255,209,102,0.45)] scale-110'
                        : 'border-white/20 hover:border-white/50 opacity-70 hover:opacity-100'
                    )}
                  />
                ))}
              </div>
              <p className="mt-1.5 text-[7px] text-center text-[#ffcf99]/50">{CARD_ACCENT_META[cardAccent].label}</p>
            </div>
'''

content = content[:idx_ui] + NEW_UI + content[idx_ui_end:]

with open(FILE, 'w') as f:
    f.write(content)

# Verify
remaining = content.count('ShareCardThemeId') + content.count('SHARE_CARD_THEMES') + content.count('shareCardTheme')
print("Remaining old references:", remaining)
print("New CardMode count:", content.count('CardMode'))
print("New CARD_THEMES count:", content.count('CARD_THEMES'))
print("File length:", len(content.split('\n')), "lines")
