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
5. **초기 비밀번호 변경:** 학생 계정의 초기 비밀번호(아이디와 동일) 변경 유도
6. **매주 클리닉 초기화:** 매주 월요일 00:00에 모든 클리닉 예약 자동 초기화

## 자동화 기능

### 매주 클리닉 예약 초기화 설정

매주 월요일 자정에 모든 클리닉의 학생 예약을 자동으로 초기화하려면 다음 단계를 따르세요:

1. **백엔드 디렉토리로 이동:**

   ```bash
   cd backend
   ```

2. **자동 설정 스크립트 실행:**

   ```bash
   ./scripts/setup_weekly_reset_cron.sh
   ```

3. **수동 실행 (테스트용):**

   ```bash
   # 강제 실행 (요일 상관없이)
   python manage.py reset_weekly_clinics --force

   # 시뮬레이션 (실제 변경 없이 테스트)
   python manage.py reset_weekly_clinics --dry-run --force
   ```

4. **로그 확인:**

   ```bash
   tail -f logs/weekly_reset.log
   ```

5. **cron job 확인:**
   ```bash
   crontab -l | grep reset_weekly_clinics
   ```

**참고:** 이 기능은 Django admin의 "선택한 클리닉의 학생 예약 초기화" 액션과 동일한 작업을 자동으로 수행합니다.

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

## 기술 스택

- **백엔드:** Django, Django REST Framework, PostgreSQL
- **프론트엔드:** Next.js, React, TailwindCSS, Chakra UI
- **인증:** Django Token Authentication
- **배포:** Railway (백엔드), Vercel (프론트엔드)
