# Generated by Django 5.0.3 on 2025-07-23 04:26

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0012_weeklyreservationperiod_clinic_weekly_period'),
    ]

    operations = [
        migrations.AddField(
            model_name='student',
            name='id_generated',
            field=models.BooleanField(default=False),
        ),
    ]
