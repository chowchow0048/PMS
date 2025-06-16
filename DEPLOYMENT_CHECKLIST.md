# 🚀 PMS 프로젝트 배포 체크리스트

배포하기 전에 다음 항목들을 순서대로 확인하세요.

## 📋 사전 준비 체크리스트

### ✅ 코드 준비

- [ㅇ] GitHub 저장소에 최신 코드 푸시 완료
- [ㅇ] `main` 또는 `master` 브랜치가 안정적인 상태
- [ㅇ] 로컬에서 프론트엔드 빌드 테스트 완료 (`npm run build`)
- [ㅇ] 로컬에서 백엔드 테스트 완료 (`python manage.py runserver`)

### ✅ 환경 변수 템플릿 확인

- [ ] `backend/env.production.example` 파일 확인
- [ ] `frontend/env.local.example` 파일 확인
- [ ] 모든 환경 변수가 명시되어 있는지 확인

## 🗄️ Railway 백엔드 배포 체크리스트

### ✅ PostgreSQL 데이터베이스 설정

- [ ] Railway에서 PostgreSQL 서비스 생성
- [ ] 데이터베이스 이름 설정 (예: `pms-database`)
- [ ] `DATABASE_URL` 환경 변수 값 복사

### ✅ Django 백엔드 서비스 설정

- [ ] Railway에서 새 서비스 생성
- [ ] GitHub 저장소 연결
- [ ] Root Directory를 `backend`로 설정
- [ ] 다음 환경 변수 설정:
  - [ ] `SECRET_KEY` (Django 시크릿 키)
  - [ ] `DEBUG=False`
  - [ ] `ALLOWED_HOSTS` (Railway 도메인)
  - [ ] `DATABASE_URL` (PostgreSQL 연결 URL)
  - [ ] `CORS_ALLOWED_ORIGINS` (임시로 `*` 설정, 나중에 수정)

### ✅ 배포 후 초기 설정

- [ ] Railway 콘솔에서 `python manage.py migrate` 실행
- [ ] Railway 콘솔에서 `python manage.py collectstatic --noinput` 실행
- [ ] 슈퍼유저 생성 (선택사항): `python manage.py createsuperuser`
- [ ] 백엔드 URL 확인 및 기록 (예: `https://your-app.railway.app`)

### ✅ 백엔드 동작 확인

- [ ] `https://your-railway-url/admin/` 접속하여 Django 관리자 페이지 확인
- [ ] `https://your-railway-url/api/` 접속하여 API 응답 확인
- [ ] 로그에서 오류 메시지 없는지 확인

## 🌐 Vercel 프론트엔드 배포 체크리스트

### ✅ Vercel 프로젝트 설정

- [ ] Vercel에서 새 프로젝트 생성
- [ ] GitHub 저장소 연결
- [ ] Root Directory를 `frontend`로 설정
- [ ] Framework Preset을 `Next.js`로 선택

### ✅ 환경 변수 설정

- [ ] `NEXT_PUBLIC_API_URL` (Railway 백엔드 URL로 설정)
- [ ] `NEXT_PUBLIC_FRONTEND_URL` (임시로 비워두기, 배포 후 설정)
- [ ] `NODE_ENV=production`

### ✅ 배포 설정 확인

- [ ] Build Command: `npm run build`
- [ ] Output Directory: `.next`
- [ ] Install Command: `npm install`
- [ ] 배포 시작

### ✅ 프론트엔드 동작 확인

- [ ] Vercel 프론트엔드 URL 접속
- [ ] 로그인 페이지 정상 로드 확인
- [ ] 브라우저 개발자 도구에서 API 호출 오류 없는지 확인

## 🔧 배포 후 최종 설정 체크리스트

### ✅ CORS 설정 업데이트

- [ ] Railway 백엔드 환경 변수에서 `CORS_ALLOWED_ORIGINS`를 실제 Vercel 도메인으로 변경
- [ ] 예: `https://your-vercel-app.vercel.app,https://www.yourdomain.com`

### ✅ 프론트엔드 환경 변수 업데이트

- [ ] Vercel에서 `NEXT_PUBLIC_FRONTEND_URL`을 실제 도메인으로 설정
- [ ] 환경 변수 변경 후 재배포

### ✅ 최종 동작 테스트

- [ ] 프론트엔드에서 회원가입/로그인 테스트
- [ ] 학생 관리 기능 테스트
- [ ] 교사 관리 기능 테스트
- [ ] 학생 배치 기능 테스트
- [ ] 마이페이지 기능 테스트
- [ ] 반응형 디자인 확인 (모바일, 태블릿, 데스크톱)

## 🔐 보안 체크리스트

### ✅ Django 보안 설정

- [ ] `DEBUG=False` 설정 확인
- [ ] `SECRET_KEY`가 강력한 값으로 설정됨
- [ ] `ALLOWED_HOSTS`에 실제 도메인만 포함
- [ ] HTTPS 리다이렉트 설정 활성화됨

### ✅ 데이터베이스 보안

- [ ] 데이터베이스 연결이 SSL로 암호화됨
- [ ] 불필요한 포트가 외부에 노출되지 않음
- [ ] 백업 정책 설정 (Railway 자동 백업 확인)

### ✅ API 보안

- [ ] CORS 설정이 특정 도메인으로 제한됨
- [ ] API 인증이 정상 작동함
- [ ] 민감한 정보가 로그에 노출되지 않음

## 📊 성능 및 모니터링 체크리스트

### ✅ 성능 최적화

- [ ] 프론트엔드 빌드 크기 확인
- [ ] 이미지 최적화 확인
- [ ] API 응답 시간 확인

### ✅ 모니터링 설정

- [ ] Railway 로그 모니터링 설정
- [ ] Vercel 함수 로그 확인
- [ ] 오류 추적 시스템 설정 (선택사항)

## 🔄 배포 후 운영 체크리스트

### ✅ 도메인 및 SSL (선택사항)

- [ ] 커스텀 도메인 연결
- [ ] SSL 인증서 자동 갱신 확인
- [ ] DNS 설정 확인

### ✅ 백업 및 복구

- [ ] 데이터베이스 정기 백업 설정
- [ ] 복구 절차 문서화
- [ ] 코드 저장소 백업 확인

### ✅ 사용자 교육

- [ ] 시스템 사용 가이드 작성
- [ ] 관리자 권한 설정
- [ ] 사용자 매뉴얼 제공

## ❌ 문제 해결 체크리스트

### 배포 실패 시

- [ ] Railway/Vercel 배포 로그 확인
- [ ] 환경 변수 설정 재확인
- [ ] 코드 의존성 문제 확인
- [ ] 빌드 명령어 및 설정 재확인

### CORS 오류 시

- [ ] `CORS_ALLOWED_ORIGINS` 설정 확인
- [ ] 도메인 철자 및 프로토콜 확인
- [ ] 브라우저 캐시 클리어

### 데이터베이스 연결 오류 시

- [ ] `DATABASE_URL` 설정 확인
- [ ] PostgreSQL 서비스 상태 확인
- [ ] 네트워크 연결 상태 확인

## 📞 긴급 상황 대응

### 🚨 서비스 중단 시

1. Railway/Vercel 서비스 상태 페이지 확인
2. 로그 분석을 통한 원인 파악
3. 이전 안정 버전으로 롤백
4. 사용자에게 상황 안내

### 📧 연락처

- Railway 지원: [Railway 지원 센터](https://railway.app/help)
- Vercel 지원: [Vercel 지원 센터](https://vercel.com/support)

---

✅ **모든 체크리스트 완료 후 배포를 진행하세요!**

배포 완료 후에는 정기적으로 서비스 상태를 모니터링하고, 사용자 피드백을 수집하여 지속적으로 개선하세요.
