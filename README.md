# Hands-Free Voice Chat

Browser-based no-touch voice loop:

1. Listen with Web Speech Recognition
2. Send transcript to an optional agent endpoint
3. Speak response with browser Text-to-Speech
4. Resume listening automatically

## Use

Open `index.html` over HTTPS or GitHub Pages. Press **Start voice chat** once and allow microphone access.

If **Agent endpoint** is blank, it runs demo replies locally.

For a real assistant, set endpoint to a backend that accepts:

```json
{"message":"hello"}
```

and returns:

```json
{"reply":"Hi, I am here."}
```

## Notes

- Works best in Chrome / Edge.
- Microphone access generally requires HTTPS, except localhost.
- Telegram cannot provide true no-touch live calls to bots, so this page is the browser bridge.
