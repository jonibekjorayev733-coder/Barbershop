
class UserServer:
    def __init__(self, users=None):
        self.users = users or []

    def get_users(self):
        return self.users

    def add_user(self, user):
        user["id"] = len(self.users) + 1
        self.users.append(user)
        return user

    def update_user(self, user_id, new_data):
        for user in self.users:
            if user["id"] == user_id:
                user.update(new_data)
                return user
        return None

    def delete_user(self, user_id):
        count_before = len(self.users)
        self.users = [u for u in self.users if u["id"] != user_id]
        return len(self.users) < count_before

    def total_age(self):
        return sum(u["age"] for u in self.users if "age" in u)