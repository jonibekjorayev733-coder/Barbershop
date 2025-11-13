
class PostServer:
    def __init__(self):
        self.posts = []

    def get_posts(self):
        return self.posts

    def add_post(self, post):
        post["id"] = len(self.posts) + 1
        self.posts.append(post)
        return post

    def update_post(self, post_id, new_data):
        for post in self.posts:
            if post["id"] == post_id:
                post.update(new_data)
                return post
        return None

    def delete_post(self, post_id):
        count_before = len(self.posts)
        self.posts = [p for p in self.posts if p["id"] != post_id]
        return len(self.posts) < count_before