from django.shortcuts import render, get_object_or_404
from rest_framework.response import Response
from .serializers import TaskSerializer, RegisterSerializer
from .models import Task
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework import generics
from django.contrib.auth.models import User


# Create your views here.

class TaskList(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):
        tasks = Task.objects.filter(owner=request.user)
        serializer = TaskSerializer(tasks,many=True)
        return Response(serializer.data)
        
    def post(self, request):
        serializer = TaskSerializer(data= request.data)
        if serializer.is_valid():
            serializer.save(owner=request.user)
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)
    

class TaskDetail(APIView):
    permission_classes = [IsAuthenticated]

    def get(self,request,pk):
        task = get_object_or_404(Task, pk=pk,owner=request.user)
        serializer = TaskSerializer(task)
        return Response(serializer.data)

    def put(self, request, pk):
        task = get_object_or_404(Task, pk=pk, owner=request.user)
        serializer = TaskSerializer(task, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    def patch(self, request,pk):
        task = get_object_or_404(Task, pk=pk, owner=request.user)
        serializer = TaskSerializer(task, data=request.data, partial=True)

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        
        return Response(serializer.errors, status=400)

    def delete(self,request, pk):
        task = get_object_or_404(Task, pk=pk,owner=request.user)
        task.delete()
        return Response(status=204)

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer

class UserInfoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            "username": request.user.username
        })    






