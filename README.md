# Wathematica Advent Calender 2026
This repo hosts a software for Wathematica Advent Calender 2026.
Given the current situation, I have adopted an architecture that allows for posting articles without needing to log in, using a Discord bot and GitHub Actions.
## About this repo 
The directory structure of this repository is as follows:
```
Bot/     Discordから記事を受け付け、GitHubへ保存するBot
Front/   記事ファイルからHTMLを生成するAstroの静的サイト
```

## Dependencies
If you want to deploy this software, you need to install below dependencies 
- uv
- Node.js

If Nix is ​​installed on your computer, using flake.nix as follows makes it easier to set up dependencies.
```
nix develop
```

## Environment Variables

## Frontend

```sh
cd Front
npm ci
npm run dev
```

本番用HTMLは`npm run build`で`Front/dist/`に生成します。
記事・画像・PDFはビルド時に同梱し、閲覧中のAPI通信は行いません。
公開日は端末時計の日本時間で判定します。
詳細は[Front/README.md](Front/README.md)を参照してください。

## Deployment

静的ホスティングのルートを`Front`、ビルドを`npm run build`、公開ディレクトリを`dist`に設定します。
