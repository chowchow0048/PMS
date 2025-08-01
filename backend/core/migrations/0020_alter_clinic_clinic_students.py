# Generated by Django 5.0.3 on 2025-07-24 15:59

from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0019_add_clinic_is_active_field'),
    ]

    operations = [
        migrations.AlterField(
            model_name='clinic',
            name='clinic_students',
            field=models.ManyToManyField(blank=True, limit_choices_to={'is_student': True}, related_name='enrolled_clinics', to=settings.AUTH_USER_MODEL, verbose_name='예약한 학생들'),
        ),
    ]
