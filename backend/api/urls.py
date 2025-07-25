from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# 라우터 생성
router = DefaultRouter()
# 뷰셋 등록 - Student 모델 삭제로 StudentViewSet 제거
# router.register(r"students", views.StudentViewSet)  # Student 모델 삭제로 주석처리
# backward compatibility를 위한 students 엔드포인트 (UserViewSet을 사용)
router.register(
    r"students", views.UserViewSet, basename="students"
)  # deprecated - users 사용 권장
router.register(r"users", views.UserViewSet)  # is_student 필터링으로 학생 관리
router.register(r"subjects", views.SubjectViewSet)
# router.register(r"times", views.TimeViewSet)  # 보충 시스템 개편으로 주석처리
router.register(r"clinics", views.ClinicViewSet)
# router.register(r"comments", views.CommentViewSet)  # 보충 시스템 개편으로 주석처리

urlpatterns = [
    # 헬스체크 API (Railway 배포용)
    path("health/", views.HealthCheckView.as_view(), name="health_check"),
    # 학생 관련 API들을 User 기반으로 변경 - UserViewSet 사용
    path(
        "users/upload-student-excel/",
        views.UserViewSet.as_view({"post": "upload_student_excel"}),
        name="user_upload_student_excel",
    ),
    # 보충 신청 엑셀 업로드 API - 현재 기능 없음 (추후 구현 필요)
    # path(
    #     "clinics/upload-enrollment/",
    #     views.ClinicViewSet.as_view({"post": "upload_clinic_enrollment"}),
    #     name="clinic_upload_enrollment",
    # ),
    # 클리닉 예약 관련 API
    path(
        "clinics/reserve/",
        views.ClinicViewSet.as_view({"post": "reserve_clinic"}),
        name="clinic_reserve",
    ),
    path(
        "clinics/cancel-reservation/",
        views.ClinicViewSet.as_view({"post": "cancel_reservation"}),
        name="clinic_cancel_reservation",
    ),
    path(
        "clinics/weekly-schedule/",
        views.ClinicViewSet.as_view({"get": "weekly_schedule"}),
        name="clinic_weekly_schedule",
    ),
    # 기본 API 엔드포인트 (users, subjects, clinics) - Student 모델 삭제로 students 제거
    path("", include(router.urls)),
    # 인증 관련 API
    path("auth/login/", views.LoginView.as_view(), name="login"),
    path("auth/logout/", views.LogoutView.as_view(), name="logout"),
    path("auth/register/", views.UserRegistrationView.as_view(), name="register"),
    path(
        "auth/change_password/",
        views.ChangePasswordView.as_view(),
        name="change_password",
    ),
    # 마이페이지 관련 API
    path("mypage/<int:user_id>/", views.UserMyPageView.as_view(), name="user_mypage"),
    # 오늘의 클리닉 API
    path("today-clinic/", views.TodayClinicView.as_view(), name="today_clinic"),
    path(
        "mypage/clinics/",
        views.ClinicViewSet.as_view({"get": "list", "post": "create"}),
        name="mypage_clinics",
    ),
    path(
        "mypage/clinics/<int:pk>/",
        views.ClinicViewSet.as_view(
            {"get": "retrieve", "put": "update", "delete": "destroy"}
        ),
        name="mypage_clinic_detail",
    ),
    # 학생 배치 관련 API
    path(
        "student-placement/",
        views.StudentPlacementView.as_view({"get": "list"}),
        name="student_placement",
    ),
    path(
        "student-placement/update/",
        views.StudentPlacementView.as_view({"post": "update_placements"}),
        name="student_placement_update",
    ),
]
