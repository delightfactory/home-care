---
description: Fix Arabic RTL text direction in Antigravity chat panel
---

# Fix Arabic RTL in Antigravity

This workflow re-applies the BiDi (Bidirectional) text fix to the Antigravity chat panel.
Run this after any Antigravity update that resets the `cascade-panel.html` file.

// turbo-all

1. Apply the RTL fix to cascade-panel.html:

```powershell
@'
<!doctype html>
<html dir="auto">

<head>
  <style>
    body,
    #react-app {
      direction: ltr;
    }

    p, li, span, div,
    h1, h2, h3, h4, h5, h6,
    blockquote, pre, code,
    td, th, caption, label,
    summary, figcaption {
      unicode-bidi: plaintext;
    }

    p, li,
    h1, h2, h3, h4, h5, h6,
    blockquote {
      text-align: start;
    }

    textarea,
    input[type="text"],
    [contenteditable="true"] {
      unicode-bidi: plaintext;
      text-align: start;
    }
  </style>
</head>

<body style="margin: 0">
  <div id="react-app" class="react-app-container"></div>
</body>

</html>
'@ | Set-Content "$env:LOCALAPPDATA\Programs\Antigravity\resources\app\extensions\antigravity\cascade-panel.html" -Encoding UTF8
```

2. Verify the fix was applied:

```powershell
Get-Content "$env:LOCALAPPDATA\Programs\Antigravity\resources\app\extensions\antigravity\cascade-panel.html" | Select-String "unicode-bidi"
```

3. Restart Antigravity to see the changes.
