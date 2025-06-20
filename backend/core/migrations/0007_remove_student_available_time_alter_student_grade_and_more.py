# Generated by Django 5.0.3 on 2025-06-10 06:18

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0006_student_available_time_user_available_time'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='student',
            name='available_time',
        ),
        migrations.AlterField(
            model_name='student',
            name='grade',
            field=models.CharField(choices=[('예비고1', '예비고1'), ('1학년', '1학년'), ('2학년', '2학년'), ('3학년', '3학년')], default='1학년', max_length=10),
        ),
        migrations.RemoveField(
            model_name='user',
            name='available_time',
        ),
        migrations.AddField(
            model_name='student',
            name='available_time',
            field=models.ManyToManyField(blank=True, related_name='students_available_time', to='core.time'),
        ),
        migrations.AddField(
            model_name='user',
            name='available_time',
            field=models.ManyToManyField(blank=True, related_name='teachers_available_time', to='core.time'),
        ),
    ]
