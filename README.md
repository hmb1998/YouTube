# YouTube Discord Bot

تەنها یەک Slash Command هەیە:

`/youtube link: https://www.youtube.com/watch?v=...`

## چی دەکات؟
- بەکارهێنەر دەبێت لە Voice Channel بێت.
- لینکەکەی YouTube وەردەگرێت.
- بۆتەکە دەچێتە ناو هەمان Voice Channel.
- گۆرانییەکە پەخش دەکات.
- کاتێک گۆرانییەکە کۆتایی هات، بۆتەکە دەتوانێت Voice Channel بەجێبهێڵێت.

## Railway
لە Railway > Variables ئەمە زیاد بکە:

TOKEN = Discord Bot Token

پاشان Deploy بکە.

## Discord Permissions
بۆتەکە لە Voice Channel پێویستی بەمانە هەیە:
- View Channel
- Connect
- Speak

## Discord Developer Portal
لە Bot > Privileged Gateway Intents پێویستە:
- Server Members Intent: ON
- Message Content Intent: ON
- Presence Intent: پێویست نییە بۆ ئەم بۆتە.

## بەکارهێنان
1. بچۆ Voice Channel.
2. بنووسە:
   `/youtube`
3. لە `link` لینکی هەر گۆرانییەکی YouTube دابنێ.
4. Send بکە.

تێبینی: YouTube هەندێک جار ڕێگە بە stream ـکردنی هەموو ڤیدیۆکان نادات؛ ئەگەر ڤیدیۆیەکی تایبەت/بەردەست نەبێت، بۆتەکە هەڵەی playback دەدات.
