
class TodoServer:
    def __init__(self):
        self.todos = []

    def get_todos(self):
        return self.todos

    def add_todo(self, todo):
        todo["id"] = len(self.todos) + 1
        self.todos.append(todo)
        return todo

    def update_todo(self, todo_id, new_data):
        for todo in self.todos:
            if todo["id"] == todo_id:
                todo.update(new_data)
                return todo
        return None

    def delete_todo(self, todo_id):
        count_before = len(self.todos)
        self.todos = [t for t in self.todos if t["id"] != todo_id]
        return len(self.todos) < count_before