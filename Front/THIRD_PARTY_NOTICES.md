# Calendar component attribution

`src/components/Calendar.tsx` and `src/components/DayTag.tsx` are adapted from
[`app/calendar.tsx` in tori3-po4/wathematica-advent2025](https://github.com/tori3-po4/wathematica-advent2025/blob/main/app/calendar.tsx).

The Sunday-first seven-column calendar, day cells, first author icon, and additional
author count are retained. The React components run inside an Astro static site,
with build-time content, year-derived weekday alignment, local-clock date
gating, accessible filter buttons, and project-local styles.

The upstream license is reproduced below.

```text
MIT License

Copyright (c) 2026 鳥山　伊織

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
