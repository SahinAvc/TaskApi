from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from .models import Task


class AuthTests(APITestCase):
    def test_register_creates_user(self):
        response = self.client.post(
            "/api/register/",
            {
                "username": "yeni_kullanici",
                "email": "yeni@ornek.com",
                "password": "GucluSifre123!",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username="yeni_kullanici").exists())

    def test_token_auth_returns_token(self):
        User.objects.create_user(
            username="giris",
            email="giris@ornek.com",
            password="GucluSifre123!",
        )
        response = self.client.post(
            "/api-token-auth/",
            {"username": "giris", "password": "GucluSifre123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("token", response.data)

    def test_tasks_require_authentication(self):
        response = self.client.get("/api/tasks/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class TaskOwnershipTests(APITestCase):
    def setUp(self):
        self.user_a = User.objects.create_user(
            username="kullanici_a",
            email="a@ornek.com",
            password="GucluSifre123!",
        )
        self.user_b = User.objects.create_user(
            username="kullanici_b",
            email="b@ornek.com",
            password="GucluSifre123!",
        )
        self.token_a = Token.objects.create(user=self.user_a)
        self.token_b = Token.objects.create(user=self.user_b)
        self.task_a = Task.objects.create(
            title="A görevi",
            owner=self.user_a,
            status="todo",
            priority="medium",
        )
        self.task_b = Task.objects.create(
            title="B görevi",
            owner=self.user_b,
            status="doing",
            priority="high",
        )

    def auth_as(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    def test_list_returns_only_own_tasks(self):
        self.auth_as(self.token_a)
        response = self.client.get("/api/tasks/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [item["id"] for item in response.data]
        self.assertIn(self.task_a.id, ids)
        self.assertNotIn(self.task_b.id, ids)

    def test_cannot_retrieve_other_users_task(self):
        self.auth_as(self.token_a)
        response = self.client.get(f"/api/tasks/{self.task_b.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_update_other_users_task(self):
        self.auth_as(self.token_a)
        response = self.client.patch(
            f"/api/tasks/{self.task_b.id}/",
            {"status": "done"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.task_b.refresh_from_db()
        self.assertEqual(self.task_b.status, "doing")

    def test_cannot_delete_other_users_task(self):
        self.auth_as(self.token_a)
        response = self.client.delete(f"/api/tasks/{self.task_b.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(Task.objects.filter(pk=self.task_b.id).exists())

    def test_create_task_assigns_owner(self):
        self.auth_as(self.token_a)
        response = self.client.post(
            "/api/tasks/",
            {
                "title": "Yeni görev",
                "description": "Açıklama",
                "status": "todo",
                "priority": "low",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        task = Task.objects.get(pk=response.data["id"])
        self.assertEqual(task.owner, self.user_a)

    def test_user_info_requires_auth(self):
        response = self.client.get("/api/user/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_user_info_returns_username(self):
        self.auth_as(self.token_a)
        response = self.client.get("/api/user/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "kullanici_a")
