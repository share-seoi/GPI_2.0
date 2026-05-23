# GPI 2.0 Precision Studio

이미지를 넣으면 영어 이미지 프롬프트를 만들어 주는 로컬 웹앱입니다.
OpenAI API Key는 쓰지 않고, ChatGPT/Codex OAuth 또는 Gemini API Key로 사용합니다.

## 1. 완전 초보자용 실행 순서

GitHub Releases에서 `GPI_2.0_Portable.zip`을 받은 사람은 아래처럼 하면 됩니다.

```text
1. GPI_2.0_Portable.zip 압축 풀기
2. GPI 실행.bat 더블클릭
3. 브라우저가 자동으로 열림
```

이 방식은 Node.js 설치가 필요 없습니다.

소스코드로 받은 사람만 아래 순서를 사용하세요.

헷갈리면 먼저 이 파일을 열어 보세요.

```text
0_READ_ME_FIRST.txt
```

처음 한 번만 Node.js를 설치합니다.

```text
https://nodejs.org/
```

GitHub에서 받은 뒤 `GPI_2.0` 폴더를 엽니다.

처음 설치할 때 여는 파일:

```text
1_INSTALL_FIRST.bat
```

설치가 끝난 뒤, GPI를 실행할 때 여는 파일:

```text
2_RUN_GPI.bat
```

`2_RUN_GPI.bat`가 서버를 켠 뒤 브라우저를 자동으로 엽니다.

브라우저 주소:

```text
http://127.0.0.1:8787
```

검은 서버 창은 앱을 쓰는 동안 닫지 마세요. GPI를 끄고 싶을 때 그 창을 닫으면 됩니다.

## 2. Git clone으로 받은 경우

PowerShell에서:

```powershell
git clone <repo-url>
cd GPI_2.0
```

그다음 파일 탐색기에서 `GPI_2.0` 폴더를 열고 순서대로 실행합니다.

```text
1_INSTALL_FIRST.bat
2_RUN_GPI.bat
```

기존 방식도 됩니다.

```powershell
.\start.ps1
```

또는:

```powershell
npm install
npm run dev
```

## 3. ChatGPT OAuth 로그인

OpenAI API Key는 필요 없습니다.

1. 앱 상단 중앙의 `chat gpt oauth 로그인` 버튼을 누릅니다.
2. 로그인 창이 뜨면 OpenAI/Codex 로그인을 끝냅니다.
3. 앱으로 돌아와 같은 버튼을 다시 누릅니다.
4. 버튼과 상태 표시가 초록색이면 준비 완료입니다.

직접 로그인해야 할 때:

```powershell
npx @openai/codex login
```

OpenAI OAuth 모델:

- `gpt-5.5`
- `gpt-5.4`
- `gpt-5.4-mini`

추론 강도:

- `low`
- `medium`
- `high`
- `xhigh`

## 4. Gemini API Key 입력

1. 앱 상단 중앙의 `gemini api key 입력` 버튼을 누릅니다.
2. Gemini API Key를 붙여넣습니다.
3. `저장`을 누릅니다.
4. 버튼과 상태 표시가 초록색이면 준비 완료입니다.

Gemini 모델:

- `gemini-3.5-flash`
- `gemini-3.1-flash-lite`

Gemini Thinking:

- `minimal`
- `low`
- `medium`
- `high`

Gemini 키는 로컬에만 저장됩니다.

```text
.gpi/local.json
```

## 5. 기본 사용법

1. 이미지를 넣습니다.
   - 드래그앤드랍
   - `파일` 버튼
   - 이미지 URL 입력
   - 클립보드 이미지/URL 붙여넣기
2. Provider와 모델을 고릅니다.
3. 필요하면 키워드를 입력합니다.
4. `생성`을 누릅니다.
5. 결과를 복사하거나 기록에서 다시 불러옵니다.

지원 이미지:

- jpg
- png
- webp
- 최대 20MB

## 6. 단축키

| 단축키 | 기능 |
|---|---|
| `F1` | 생성 |
| `F5` | 같은 이미지로 재실행 |
| `Ctrl+V` | 이미지 또는 URL 붙여넣기 |
| `Ctrl+C` | 결과 복사 |
| `Esc` | 생성 중단 |

## 7. 로컬 파일

아래 파일은 자동 생성되며 Git에 올리지 않습니다.

```text
.gpi/local.json    # Gemini API Key
.gpi/history.json  # 최근 기록
.gpi/logs.jsonl    # 실행 로그
node_modules/      # npm 설치 파일
dist/              # 빌드 결과
```

## 8. 문제 해결

`npm`을 찾을 수 없으면 Node.js를 설치한 뒤 PowerShell을 새로 열어 확인합니다.

```powershell
node --version
npm --version
```

앱 주소가 안 열리면 서버가 실행 중인지 확인합니다.

```powershell
npm run dev
```

8787 포트가 막혀 있으면:

```powershell
$env:PORT=8790
npm run dev
```

그다음 `http://127.0.0.1:8790`을 엽니다.

이미지 URL이 안 되면 사이트가 외부 다운로드를 막는 경우가 많습니다. 이미지를 파일로 저장해서 넣거나, 브라우저에서 이미지를 복사한 뒤 `Ctrl+V`를 사용하세요.

## 9. 점검

```powershell
npm run check
```

빌드까지 성공하면 정상입니다.

## 10. 배포 ZIP 만들기

개발자가 GitHub Releases에 올릴 ZIP을 만들 때:

```powershell
npm run release:portable
```

완성 파일:

```text
release/GPI_2.0_Portable.zip
```
