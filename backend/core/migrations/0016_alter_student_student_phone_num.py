# Generated by Django 5.0.3 on 2025-07-24 08:10

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0015_user_student_phone_num'),
    ]

    operations = [
        migrations.AlterField(
            model_name='student',
            name='student_phone_num',
            field=models.CharField(blank=True, max_length=15),
        ),
    ]
