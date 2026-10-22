# TaskApi

Django REST Framework ile geliştirilmiş görev yönetimi uygulaması. Projede API ile iletişim kuran bir web arayüzü de bulunur.

## Özellikler

- Kullanıcı kaydı ve token ile giriş
- Kullanıcıya özel görev oluşturma, listeleme, güncelleme ve silme
- Görev durumu, önceliği ve son tarihi
- Takvim, istatistik ve ayarlar ekranları

## Kurulum

PowerShell’de proje klasöründe:

```powershell
.\venv\Scripts\Activate.ps1
$env:DJANGO_SECRET_KEY = (& python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())").Trim()
$env:DJANGO_DEBUG = "True"
python -m pip install django djangorestframework
python manage.py migrate
python manage.py runserver