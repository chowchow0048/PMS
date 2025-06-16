from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# 라우터 생성
router = DefaultRouter()
# 뷰셋 등록
router.register(r"students", views.StudentViewSet)
router.register(r"users", views.UserViewSet)
router.register(r"subjects", views.SubjectViewSet)
router.register(r"times", views.TimeViewSet)
router.register(r"clinics", views.ClinicViewSet)
router.register(r"comments", views.CommentViewSet)

urlpatterns = [
    # 엑셀 업로드 API (라우터 등록 전에 배치하여 충돌 방지)
    path(
        "students/upload-excel/",
        views.StudentViewSet.as_view({"post": "upload_excel"}),
        name="student_upload_excel",
    ),
    # 기본 API 엔드포인트 (users, subjects, times, students, clinics, comments)
    path("", include(router.urls)),
    # 인증 관련 API
    path("auth/login/", views.LoginView.as_view(), name="login"),
    path("auth/logout/", views.LogoutView.as_view(), name="logout"),
    path("auth/register/", views.UserRegistrationView.as_view(), name="register"),
    # 마이페이지 관련 API
    path("mypage/<int:user_id>/", views.UserMyPageView.as_view(), name="user_mypage"),
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
    path(
        "mypage/comments/",
        views.CommentViewSet.as_view({"get": "list", "post": "create"}),
        name="mypage_comments",
    ),
    path(
        "mypage/comments/<int:pk>/",
        views.CommentViewSet.as_view(
            {"get": "retrieve", "put": "update", "delete": "destroy"}
        ),
        name="mypage_comment_detail",
    ),
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
    # 선생님 시간표 수정 API
    path(
        "teachers/<int:teacher_id>/available-time/",
        views.TeacherAvailableTimeUpdateView.as_view(),
        name="teacher_available_time_update",
    ),
]
