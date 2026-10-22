from django.urls import path
from .views import TaskList, TaskDetail, RegisterView, UserInfoView

urlpatterns = [
    path('tasks/', TaskList.as_view()),
    path('tasks/<int:pk>/', TaskDetail.as_view()),
    path('register/', RegisterView.as_view()),
    path("user/", UserInfoView.as_view(), name="user-info"),

]