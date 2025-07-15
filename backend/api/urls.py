from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# 라우터 생성
router = DefaultRouter()
# 뷰셋 등록
router.register(r"students", views.StudentViewSet)
router.register(r"users", views.UserViewSet)
router.register(r"subjects", views.SubjectViewSet)
# router.register(r"times", views.TimeViewSet)  # 보충 시스템 개편으로 주석처리
router.register(r"clinics", views.ClinicViewSet)
# router.register(r"comments", views.CommentViewSet)  # 보충 시스템 개편으로 주석처리

urlpatterns = [
    # 엑셀 업로드 API (라우터 등록 전에 배치하여 충돌 방지)
    path(
        "students/upload-excel/",
        views.StudentViewSet.as_view({"post": "upload_excel"}),
        name="student_upload_excel",
    ),
    # 보충 신청 엑셀 업로드 API
    path(
        "clinics/upload-enrollment/",
        views.ClinicViewSet.as_view({"post": "upload_clinic_enrollment"}),
        name="clinic_upload_enrollment",
    ),
    # 기본 API 엔드포인트 (users, subjects, students, clinics) - 보충 시스템 개편으로 times, comments 제거
    path("", include(router.urls)),
    # 인증 관련 API
    path("auth/login/", views.LoginView.as_view(), name="login"),
    path("auth/logout/", views.LogoutView.as_view(), name="logout"),
    path("auth/register/", views.UserRegistrationView.as_view(), name="register"),
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
    # 보충 시스템 개편으로 주석처리
    # path(
    #     "mypage/comments/",
    #     views.CommentViewSet.as_view({"get": "list", "post": "create"}),
    #     name="mypage_comments",
    # ),
    # path(
    #     "mypage/comments/<int:pk>/",
    #     views.CommentViewSet.as_view(
    #         {"get": "retrieve", "put": "update", "delete": "destroy"}
    #     ),
    #     name="mypage_comment_detail",
    # ),
    # 학생 배치 관련 API
    path(
        "student-placement/students/",
        views.StudentViewSet.as_view({"get": "list"}),
        name="student_placement_students",
    ),
    path(
        "student-placement/placement/",
        views.StudentPlacementView.as_view({"get": "list"}),
        name="student_placement_list",
    ),
    path(
        "student-placement/placement/update/",
        views.StudentPlacementView.as_view({"post": "update_placements"}),
        name="student_placement_update",
    ),
    # 보충 시스템 개편으로 주석처리
    # # 선생님 시간표 수정 API
    # path(
    #     "teachers/<int:teacher_id>/available-time/",
    #     views.TeacherAvailableTimeUpdateView.as_view(),
    #     name="teacher_available_time_update",
    # ),
    # 헬스체크 엔드포인트 - Database 연결 상태 확인
    path(
        "health/",
        views.HealthCheckView.as_view(),
        name="health_check",
    ),
]
