# PMS (Project Management System)

프로젝트 관리 시스템 - 학생 배치 및 클리닉 관리 시스템

## 프로젝트 구조

```
.
├── backend/                # Django 백엔드
│   ├── core/               # 핵심 모델 및 기능
│   │   ├── models.py       # 모든 모델 정의
│   │   ├── admin.py        # 관리자 인터페이스
│   │   └── migrations/
│   ├── api/                # API 엔드포인트
│   │   ├── urls.py
│   │   ├── views.py
│   │   └── serializers.py
│   └── config/             # 프로젝트 설정
│       ├── settings.py
│       ├── urls.py
│       └── wsgi.py
├── frontend/               # Next.js 프론트엔드
│   ├── public/             # 정적 파일
│   └── src/                # 소스 코드
├── .gitignore
└── README.md
```

## 주요 기능

1. **로그인/로그아웃:** 사용자 인증 시스템
2. **학생 배치 1단계:** 미배치 학생을 선생에게 배치
3. **학생 배치 2단계:** 선생에게 배치된 학생을 특정 요일+시간에 할당하여 클리닉 생성
4. **클리닉 출석체크:** 생성된 클리닉의 시간이 되었을 때 출석체크 가능, 출석체크 완료 시 부모님에게 문자발송

## 페이지 구성

1. **/login:** 로그인 페이지
2. **/student-placement:** 로그인 해야 진입가능, 메인페이지-학생 배치 1단계
3. **/mypage/<int:User.id>:** 로그인 해야 진입가능, 본인 mypage만 진입가능, 마이페이지-학생 배치 2단계

## 시작하기

### 백엔드 설정

```bash
# 가상환경 생성 및 활성화
python -m venv backend/venv
source backend/venv/bin/activate  # Windows: backend\venv\Scripts\activate

# 의존성 설치
pip install -r backend/requirements.txt

# 데이터베이스 마이그레이션
python backend/manage.py migrate

# 개발 서버 실행
python backend/manage.py runserver
```

### 프론트엔드 설정

```bash
# 의존성 설치
cd frontend
npm install

# 개발 서버 실행
npm run dev
```

## 리팩토링 가이드

백엔드 구조를 리팩토링하여 다음과 같은 구조로 변경하였습니다:

1. **핵심 모델 분리:** 모든 모델을 core 앱으로 이동
2. **API 엔드포인트 통합:** API 엔드포인트를 api 앱으로 통합
3. **인증 관련 기능 통합:** 인증 관련 기능을 api 앱으로 통합

### 마이그레이션 방법

리팩토링 후 마이그레이션을 위해 다음 단계를 수행하세요:

```bash
# 마이그레이션 파일 생성
python backend/manage.py makemigrations core

# 마이그레이션 적용
python backend/manage.py migrate core

# 데이터 마이그레이션
python backend/manage.py migrate_data
```

## 환경 변수

백엔드 `.env` 파일에 다음 환경 변수를 설정하세요:

```
SECRET_KEY=your_secret_key
DEBUG=True
DATABASE_URL=postgres://username:password@localhost:5432/pms
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

## 기술 스택

- **백엔드:** Django, Django REST Framework, PostgreSQL
- **프론트엔드:** Next.js, React, TailwindCSS, Chakra UI
- **인증:** Django Token Authentication
- **배포:** Railway (백엔드), Vercel (프론트엔드)

## 🚀 배포

이 프로젝트는 다음 구성으로 배포됩니다:

- **프론트엔드:** Vercel
- **백엔드:** Railway
- **데이터베이스:** Railway PostgreSQL

### 배포 가이드

배포를 위한 상세한 가이드는 다음 문서를 참조하세요:

- 📖 **[배포 가이드](DEPLOYMENT_GUIDE.md)** - 단계별 배포 방법
- ✅ **[배포 체크리스트](DEPLOYMENT_CHECKLIST.md)** - 배포 전 확인사항

### 환경 변수 템플릿

배포를 위한 환경 변수 템플릿:

- **백엔드:** `backend/env.production.example`
- **프론트엔드:** `frontend/env.local.example`

### 빠른 배포 단계

1. **Railway에서 PostgreSQL 데이터베이스 생성**
2. **Railway에서 Django 백엔드 배포** (Root Directory: `backend`)
3. **Vercel에서 Next.js 프론트엔드 배포** (Root Directory: `frontend`)
4. **환경 변수 설정 및 CORS 구성**
5. **데이터베이스 마이그레이션 실행**

자세한 내용은 [배포 가이드](DEPLOYMENT_GUIDE.md)를 확인하세요.
