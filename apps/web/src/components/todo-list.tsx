"use client";

import { useMutation, useQuery } from "convex/react";
import { TrashIcon } from "lucide-react";
import { type FormEvent, useState } from "react";

import { api } from "@whatsfiled/backend/convex/_generated/api";
import { Button } from "@whatsfiled/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@whatsfiled/ui/components/card";
import { Input } from "@whatsfiled/ui/components/input";

export function TodoList() {
  const todos = useQuery(api.todos.list);
  const createTodo = useMutation(api.todos.create);
  const toggleTodo = useMutation(api.todos.toggle);
  const removeTodo = useMutation(api.todos.remove);

  const [newTodo, setNewTodo] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!newTodo.trim()) return;
    createTodo({ text: newTodo.trim() });
    setNewTodo("");
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Todo List</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
            placeholder="Add a new todo..."
            className="flex-1"
          />
          <Button type="submit">Add</Button>
        </form>

        <ul className="space-y-2">
          {todos === undefined ? (
            <li className="text-muted-foreground text-sm">Loading...</li>
          ) : todos.length === 0 ? (
            <li className="text-muted-foreground text-sm">No todos yet</li>
          ) : (
            todos.map((todo) => (
              <li
                key={todo._id}
                className="flex items-center gap-2 rounded-md border p-2"
              >
                <input
                  type="checkbox"
                  checked={todo.completed}
                  onChange={() => toggleTodo({ id: todo._id })}
                  className="size-4 shrink-0"
                />
                <span
                  className={`flex-1 text-sm ${
                    todo.completed ? "text-muted-foreground line-through" : ""
                  }`}
                >
                  {todo.text}
                </span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => removeTodo({ id: todo._id })}
                >
                  <TrashIcon className="size-3" />
                </Button>
              </li>
            ))
          )}
        </ul>
      </CardContent>
    </Card>
  );
}
