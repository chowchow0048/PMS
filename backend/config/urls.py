"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.0/topics/http/urls/
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

# Admin 사이트 제목 설정
admin.site.site_header = "PMS 관리 시스템"
admin.site.site_title = "PMS 관리 시스템"

# Admin URL 동적 설정 (환경변수 또는 기본값 사용)
admin_url = getattr(settings, "ADMIN_URL", "admin/")

urlpatterns = [
    # Django 관리자 페이지 (동적 URL)
    path(admin_url, admin.site.urls),
    # API 경로 설정
    path("api/", include("api.urls")),
]

# 개발 환경에서만 미디어 파일 서빙 설정
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
