from rest_framework import serializers
from .models import Task
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError


class TaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = ['id', 'title', 'description', 'status', 'priority', 'due_date', 'created_at']

class RegisterSerializer(serializers.ModelSerializer):
    username = serializers.CharField(
    validators=[],
    error_messages={
        "required": "Kullanıcı adı zorunludur.",
        "blank": "Kullanıcı adı boş bırakılamaz.",
    }
)
    email = serializers.EmailField(required=True)
    password = serializers.CharField(
        write_only=True,
        trim_whitespace=False
    )

    class Meta:
        model = User
        fields = ['username', 'email', 'password']

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError(
                "Bu kullanıcı adı zaten kullanılıyor."
        )
        return value    

    def validate_password(self, value):
        user = User(
            username=self.initial_data.get('username', ''),
            email=self.initial_data.get('email', '')
        )

        try:
            validate_password(value, user=user)
        except DjangoValidationError as error:
            raise serializers.ValidationError(error.messages)

        return value

    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password']
        )
