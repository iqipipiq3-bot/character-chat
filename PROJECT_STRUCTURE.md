# Character Chat - 프로젝트 파일 구조

## 프로젝트 개요

**프로젝트명:** Character Chat
**설명:** AI 캐릭터와 대화할 수 있는 웹 애플리케이션
**기술 스택:** Next.js 16 (App Router, Turbopack) + React 19 + TypeScript + Tailwind CSS 4 + Supabase + Google Gemini API

### 주요 의존성

- `@supabase/supabase-js` / `@supabase/ssr` — 인증 및 데이터베이스
- `@google/genai` — AI 채팅 (Gemini API)
- `@dnd-kit/core` / `@dnd-kit/sortable` — 드래그 앤 드롭 정렬
- `react-markdown` / `remark-breaks` / `remark-gfm` — 마크다운 렌더링
- `@fontsource/pretendard` — 한국어 폰트

---

## 루트 디렉토리

```
character-chat/
├── .env.local                 # 환경 변수 (Supabase URL, Key 등)
├── .gitignore
├── eslint.config.mjs          # ESLint 설정
├── next.config.ts             # Next.js 설정
├── next-env.d.ts              # Next.js TypeScript 타입 선언
├── package.json               # 프로젝트 의존성 및 스크립트
├── package-lock.json
├── postcss.config.mjs         # PostCSS 설정 (Tailwind 연동)
├── tsconfig.json              # TypeScript 설정
├── PROJECT_STRUCTURE.md        # 프로젝트 파일 구조 문서 (본 파일)
├── README.md
├── tsconfig.tsbuildinfo        # TypeScript 빌드 정보 (자동 생성)
├── public/                    # 정적 파일 (SVG 아이콘 등)
└── src/                       # 소스 코드
```

---

## src/ 디렉토리 구조

```
src/
├── middleware.ts               # Supabase 인증 미들웨어 (쿠키 기반 세션 관리)
└── app/                       # Next.js App Router 루트
```

---

## src/app/ 상세 구조

### 레이아웃 & 공통 컴포넌트

```
src/app/
├── layout.tsx                 # 루트 레이아웃 (헤더, 사이드바, 바텀네비, 토스트 포함)
├── page.tsx                   # 루트 페이지 → /explore로 리다이렉트
├── globals.css                # 전역 CSS 스타일
├── favicon.ico
├── HeaderClient.tsx           # 헤더 클라이언트 컴포넌트
├── HeaderShell.tsx            # 헤더 쉘 (서버/클라이언트 분리)
├── BottomNav.tsx              # 하단 네비게이션 바 (모바일)
├── ConversationSidebar.tsx    # 대화 목록 사이드바
```

### 인증 페이지 — `(auth)/`

```
src/app/(auth)/
├── login/
│   └── page.tsx               # 로그인 페이지
└── signup/
    └── page.tsx               # 회원가입 페이지
```

### API 라우트 — `api/`

```
src/app/api/
├── attendance/
│   └── route.ts               # 출석 체크 API
├── chat/
│   └── route.ts               # AI 채팅 API (Gemini 연동)
├── credits/
│   └── route.ts               # 크레딧 관리 API
├── gemini-cache/
│   └── invalidate/
│       └── route.ts           # Gemini 캐시 무효화 API
├── lorebook-templates/
│   ├── route.ts               # 로어북 템플릿 목록/생성 API
│   └── [id]/
│       └── route.ts           # 로어북 템플릿 개별 CRUD API
├── memories/
│   ├── extract/
│   │   └── route.ts           # 메모리 추출 API (대화에서 기억 추출)
│   └── [conversationId]/
│       └── route.ts           # 대화별 메모리 관리 API
├── notices/
│   ├── route.ts               # 공지사항 목록/생성 API
│   └── [id]/
│       └── route.ts           # 공지사항 개별 CRUD API
├── notifications/
│   └── route.ts               # 알림 관리 API
└── signup-bonus/
    └── route.ts               # 회원가입 보너스 크레딧 API
```

### 페이지 & 기능 모듈

```
src/app/
├── explore/                         # 캐릭터 탐색 (메인 페이지)
│   ├── page.tsx                     # 탐색 페이지 (서버)
│   ├── ExploreClient.tsx            # 탐색 클라이언트 컴포넌트
│   └── [characterId]/
│       ├── page.tsx                 # 캐릭터 상세 페이지 (서버)
│       └── CharacterDetailClient.tsx # 캐릭터 상세 클라이언트 컴포넌트
│
├── dashboard/                       # 대시보드 (내 캐릭터 관리)
│   ├── page.tsx                     # 대시보드 페이지 (서버)
│   ├── DashboardTabsClient.tsx      # 대시보드 탭 컴포넌트
│   ├── CharacterCardsClient.tsx     # 내 캐릭터 카드 목록
│   └── PersonaSectionClient.tsx     # 페르소나 섹션
│
├── characters/                      # 캐릭터 생성/편집
│   ├── CharacterFormClient.tsx      # 캐릭터 폼 (생성/편집 공용)
│   ├── create/
│   │   └── page.tsx                 # 캐릭터 생성 페이지
│   └── [id]/
│       └── edit/
│           └── page.tsx             # 캐릭터 편집 페이지
│
├── chat/                            # 채팅
│   └── [conversationId]/
│       ├── page.tsx                 # 채팅 페이지 (서버)
│       └── ChatSidePanel.tsx        # 채팅 사이드 패널
│
├── chats/
│   └── page.tsx                     # 채팅 목록 페이지
│
├── attendance/                      # 출석 체크
│   ├── page.tsx                     # 출석 페이지 (서버)
│   └── AttendanceClient.tsx         # 출석 클라이언트 컴포넌트
│
├── favorites/                       # 즐겨찾기
│   ├── page.tsx                     # 즐겨찾기 페이지 (서버)
│   └── FavoritesClient.tsx          # 즐겨찾기 클라이언트 컴포넌트
│
├── creator/                         # 크리에이터 프로필
│   └── [userId]/
│       ├── page.tsx                 # 크리에이터 페이지 (서버)
│       └── CreatorProfileClient.tsx # 크리에이터 프로필 클라이언트
│
├── mypage/                          # 마이페이지
│   ├── page.tsx
│   └── MypageClient.tsx
│
├── my/
│   └── following/                   # 팔로잉 목록
│       ├── page.tsx
│       └── FollowingClient.tsx
│
├── notifications/                   # 알림/공지사항
│   └── page.tsx                     # 알림 페이지
│
├── personas/                        # 페르소나 관리
│   ├── page.tsx
│   └── PersonasClient.tsx
│
└── settings/                        # 설정
    └── page.tsx
```

### 공용 컴포넌트 — `components/`

```
src/app/components/
├── CharacterCard.tsx           # 캐릭터 카드 UI 컴포넌트
├── MarkdownEditor.tsx          # 마크다운 에디터
├── MarkdownRenderer.tsx        # 마크다운 렌더러
├── Toast.tsx                   # 토스트 알림 컴포넌트
└── memory/
    └── MemoryPanel.tsx         # 메모리 패널 (대화 기억 관리)
```

### 유틸리티 & 라이브러리 — `lib/`

```
src/app/lib/
├── supabase.ts                # Supabase 클라이언트 생성 함수
├── convertToWebP.ts           # 이미지 → WebP 변환 유틸
├── gradient.ts                # 그라디언트 색상 생성 유틸
├── replaceVariables.ts        # 템플릿 변수 치환 유틸
└── memory/
    └── buildMemoryPrompt.ts   # 메모리 기반 프롬프트 빌드 함수
```

### Context — `context/`

```
src/app/context/
└── HeaderContext.tsx           # 헤더 상태 관리 Context (React Context API)
```

---

## 아키텍처 패턴 요약

1. **서버/클라이언트 분리 패턴**: 각 페이지는 `page.tsx`(서버 컴포넌트)와 `*Client.tsx`(클라이언트 컴포넌트)로 분리되어 있음
2. **App Router**: Next.js App Router 사용, `(auth)` 같은 라우트 그룹 활용
3. **동적 라우팅**: `[conversationId]`, `[characterId]`, `[userId]`, `[id]` 등 동적 세그먼트 사용
4. **API Routes**: `src/app/api/` 하위에 REST API 엔드포인트 구성
5. **인증**: Supabase SSR을 통한 쿠키 기반 인증 (`middleware.ts`가 미들웨어 역할)
6. **AI 채팅**: Google Gemini API를 통한 AI 캐릭터 대화 기능
7. **메모리 시스템**: 대화에서 기억을 추출하고 프롬프트에 반영하는 구조
