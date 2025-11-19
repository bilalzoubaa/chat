from django.db import models

class Room(models.Model):
    name = models.CharField(max_length=128, unique=True)
    password_hash = models.CharField(max_length=256)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name
