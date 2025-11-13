def update_user(user_id: int, user_data: dict):
    # Demo: oddiy test ma’lumot
    if user_id == 1:
        return {"id": user_id, **user_data}
    return None
