#!/bin/bash

# 매주 월요일 00:00에 클리닉 예약을 초기화하는 cron job 설정 스크립트
# 
# 사용법:
#   chmod +x setup_weekly_reset_cron.sh
#   ./setup_weekly_reset_cron.sh

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== PMS 클리닉 주간 예약 초기화 Cron Job 설정 ===${NC}"
echo ""

# 현재 디렉토리 확인
CURRENT_DIR=$(pwd)
echo -e "현재 디렉토리: ${CURRENT_DIR}"

# Django 프로젝트 루트 디렉토리 확인
if [ ! -f "manage.py" ]; then
    echo -e "${RED}오류: manage.py 파일을 찾을 수 없습니다.${NC}"
    echo -e "${RED}Django 프로젝트 루트 디렉토리에서 실행해주세요.${NC}"
    exit 1
fi

# Python 가상환경 확인
if [ -d "venv" ]; then
    PYTHON_PATH="${CURRENT_DIR}/venv/bin/python"
    echo -e "가상환경 발견: ${CURRENT_DIR}/venv"
elif [ -n "$VIRTUAL_ENV" ]; then
    PYTHON_PATH="$VIRTUAL_ENV/bin/python"
    echo -e "활성화된 가상환경: $VIRTUAL_ENV"
else
    PYTHON_PATH="python"
    echo -e "${YELLOW}경고: 가상환경을 찾을 수 없습니다. 시스템 Python을 사용합니다.${NC}"
fi

# Cron job 명령어 생성
CRON_COMMAND="0 0 * * 1 cd ${CURRENT_DIR} && ${PYTHON_PATH} manage.py reset_weekly_clinics >> ${CURRENT_DIR}/logs/weekly_reset.log 2>&1"

echo ""
echo -e "${YELLOW}설정할 Cron Job:${NC}"
echo -e "${GREEN}${CRON_COMMAND}${NC}"
echo ""

# 로그 디렉토리 생성
if [ ! -d "${CURRENT_DIR}/logs" ]; then
    mkdir -p "${CURRENT_DIR}/logs"
    echo -e "로그 디렉토리 생성: ${CURRENT_DIR}/logs"
fi

# 사용자 확인
read -p "위의 cron job을 추가하시겠습니까? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo -e "${YELLOW}취소되었습니다.${NC}"
    exit 0
fi

# 현재 crontab 백업
echo -e "${YELLOW}현재 crontab 백업 중...${NC}"
crontab -l > "${CURRENT_DIR}/crontab_backup_$(date +%Y%m%d_%H%M%S).txt" 2>/dev/null || echo "기존 crontab이 없습니다. 새로 생성합니다."

# 기존 동일한 작업이 있는지 확인
if crontab -l 2>/dev/null | grep -q "reset_weekly_clinics"; then
    echo -e "${YELLOW}기존 reset_weekly_clinics cron job을 제거합니다.${NC}"
    crontab -l 2>/dev/null | grep -v "reset_weekly_clinics" | crontab -
fi

# 새로운 cron job 추가
echo -e "${YELLOW}새로운 cron job 추가 중...${NC}"
(crontab -l 2>/dev/null; echo "$CRON_COMMAND") | crontab -

# 추가 확인
if crontab -l | grep -q "reset_weekly_clinics"; then
    echo -e "${GREEN}✓ Cron job이 성공적으로 추가되었습니다!${NC}"
    echo ""
    echo -e "${YELLOW}현재 설정된 cron jobs:${NC}"
    crontab -l | grep -n "reset_weekly_clinics"
    echo ""
    echo -e "${YELLOW}참고사항:${NC}"
    echo -e "- 매주 월요일 00:00에 클리닉 예약이 자동으로 초기화됩니다"
    echo -e "- 로그는 ${CURRENT_DIR}/logs/weekly_reset.log 에서 확인할 수 있습니다"
    echo -e "- 수동 실행: ${PYTHON_PATH} manage.py reset_weekly_clinics --force"
    echo -e "- 시뮬레이션: ${PYTHON_PATH} manage.py reset_weekly_clinics --dry-run --force"
else
    echo -e "${RED}✗ Cron job 추가에 실패했습니다.${NC}"
    exit 1
fi

echo -e "${GREEN}설정 완료!${NC}" 