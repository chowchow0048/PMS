# PMS 프로젝트 배포 가이드

이 가이드는 PMS(Project Management System) 프로젝트를 다음 구성으로 배포하는 방법을 설명합니다:

- **프론트엔드**: Vercel (Next.js)
- **백엔드**: Railway (Django)
- **데이터베이스**: Railway PostgreSQL

## 📋 사전 준비사항

1. **계정 생성**

   - [Railway](https://railway.app) 계정 생성
   - [Vercel](https://vercel.com) 계정 생성
   - GitHub 계정 (코드 저장소)

2. **코드 저장소 준비**
   - GitHub에 프로젝트 코드 업로드
   - `main` 또는 `master` 브랜치 확인

## 🚀 1단계: Railway 백엔드 배포

### 1.1 PostgreSQL 데이터베이스 생성

1. Railway 대시보드에 로그인
2. **New Project** 클릭
3. **Provision PostgreSQL** 선택
4. 데이터베이스 이름 설정 (예: `pms-database`)
5. **Variables** 탭에서 `DATABASE_URL` 확인 및 복사

### 1.2 Django 백엔드 배포

1. Railway 대시보드에서 **New Service** 클릭
2. **GitHub Repo** 선택 후 백엔드 폴더 연결
3. **Root Directory** 설정: `backend`
4. **Environment Variables** 설정:

```bash
# 필수 환경 변수
SECRET_KEY=your-django-secret-key-here
DEBUG=False
ALLOWED_HOSTS=your-app-name.railway.app
DATABASE_URL=postgresql://[데이터베이스 URL]
CORS_ALLOWED_ORIGINS=https://your-vercel-app.vercel.app
```

5. **Deploy** 클릭하여 배포 시작
6. 배포 완료 후 도메인 URL 확인 (예: `https://your-app.railway.app`)

### 1.3 초기 데이터베이스 설정

배포 후 Railway 콘솔에서 다음 명령어 실행:

```bash
# 데이터베이스 마이그레이션
python manage.py migrate

# 슈퍼유저 생성 (선택사항)
python manage.py createsuperuser

# 정적 파일 수집
python manage.py collectstatic --noinput
```

## 🌐 2단계: Vercel 프론트엔드 배포

### 2.1 Vercel 프로젝트 생성

1. Vercel 대시보드에 로그인
2. **New Project** 클릭
3. GitHub 저장소 선택
4. **Root Directory** 설정: `frontend`
5. **Framework Preset**: Next.js 선택

### 2.2 환경 변수 설정

**Environment Variables** 섹션에서 다음 변수 추가:

```bash
# 백엔드 API URL (Railway에서 배포된 URL)
NEXT_PUBLIC_API_URL=https://your-railway-app.railway.app

# 프론트엔드 도메인
NEXT_PUBLIC_FRONTEND_URL=https://your-vercel-app.vercel.app

# 프로덕션 모드
NODE_ENV=production
```

### 2.3 배포 설정

1. **Build Command**: `npm run build` (기본값)
2. **Output Directory**: `.next` (기본값)
3. **Install Command**: `npm install` (기본값)
4. **Deploy** 클릭

## 🔧 3단계: 배포 후 설정

### 3.1 CORS 설정 업데이트

Railway 백엔드의 환경 변수에서 `CORS_ALLOWED_ORIGINS`를 실제 Vercel 도메인으로 업데이트:

```bash
CORS_ALLOWED_ORIGINS=https://your-actual-vercel-domain.vercel.app
```

### 3.2 프론트엔드 API URL 업데이트

Vercel 프론트엔드의 환경 변수에서 `NEXT_PUBLIC_API_URL`을 실제 Railway 도메인으로 업데이트:

```bash
NEXT_PUBLIC_API_URL=https://your-actual-railway-domain.railway.app
```

### 3.3 도메인 연결 (선택사항)

1. **커스텀 도메인 설정**

   - Vercel: Settings > Domains
   - Railway: Settings > Domains

2. **SSL 인증서 자동 생성** (Vercel, Railway 모두 자동)

## 🔍 4단계: 배포 확인

### 4.1 백엔드 확인

1. Railway 백엔드 URL 접속
2. `/admin/` 경로로 Django 관리자 페이지 확인
3. `/api/` 경로로 API 엔드포인트 확인

### 4.2 프론트엔드 확인

1. Vercel 프론트엔드 URL 접속
2. 로그인 페이지 로드 확인
3. 백엔드 API 연결 확인

### 4.3 데이터베이스 확인

1. Railway 데이터베이스 콘솔 접속
2. 테이블 생성 확인
3. 데이터 입력/조회 테스트

## 🔧 환경 변수 참조

### Railway (백엔드) 환경 변수

```bash
SECRET_KEY=your-django-secret-key-here
DEBUG=False
ALLOWED_HOSTS=your-railway-domain.railway.app,yourdomain.com
DATABASE_URL=postgresql://[자동 생성]
CORS_ALLOWED_ORIGINS=https://your-vercel-app.vercel.app
STATIC_URL=/static/
MEDIA_URL=/media/
```

### Vercel (프론트엔드) 환경 변수

```bash
NEXT_PUBLIC_API_URL=https://your-railway-backend.railway.app
NEXT_PUBLIC_FRONTEND_URL=https://your-vercel-app.vercel.app
NODE_ENV=production
ANALYZE=false
```

## 🚨 주의사항

1. **보안 설정**

   - `SECRET_KEY`는 반드시 강력한 값으로 설정
   - `DEBUG=False`로 프로덕션 배포
   - `ALLOWED_HOSTS`에 실제 도메인만 포함

2. **데이터베이스**

   - 정기적인 백업 설정
   - 마이그레이션 실행 후 배포

3. **정적 파일**
   - `collectstatic` 명령어 실행 확인
   - 미디어 파일 업로드 경로 확인

## 🔄 재배포 방법

### 자동 재배포 (권장)

- GitHub에 코드 푸시 시 자동 배포
- `main` 브랜치 변경 시 자동 트리거

### 수동 재배포

- Railway/Vercel 대시보드에서 **Redeploy** 클릭

## 📞 문제 해결

### 일반적인 문제

1. **CORS 에러**

   - `CORS_ALLOWED_ORIGINS` 설정 확인
   - 도메인 오타 확인

2. **데이터베이스 연결 오류**

   - `DATABASE_URL` 설정 확인
   - PostgreSQL 서비스 상태 확인

3. **정적 파일 로드 실패**
   - `collectstatic` 명령어 실행 확인
   - `STATIC_URL` 설정 확인

### 로그 확인

- **Railway**: 대시보드 > Deployments > View Logs
- **Vercel**: 대시보드 > Functions > View Logs

## 📚 추가 자료

- [Railway 공식 문서](https://docs.railway.app)
- [Vercel 공식 문서](https://vercel.com/docs)
- [Django 배포 가이드](https://docs.djangoproject.com/en/5.0/howto/deployment/)
- [Next.js 배포 가이드](https://nextjs.org/docs/deployment)

---

배포 과정에서 문제가 발생하면 각 플랫폼의 로그를 확인하고, 환경 변수 설정을 다시 검토해주세요.
