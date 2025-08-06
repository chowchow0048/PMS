#!/bin/bash

# Railway 배포 전 실행 스크립트
# 중복 데이터 정리 후 마이그레이션 실행

echo "🚀 Railway 배포 전 데이터 정리 시작..."

# 1. 중복 데이터 정리
echo "📋 중복 출석 데이터 정리..."
python manage.py fix_production_duplicates --force

# 2. 마이그레이션 실행
echo "🔄 마이그레이션 실행..."
python manage.py migrate

echo "✅ 배포 전 준비 완료!"