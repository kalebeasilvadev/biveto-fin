from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    email: EmailStr
    name: str = Field(min_length=2, max_length=100)


class UserCreate(UserBase):
    password: str = Field(min_length=6, max_length=100)


class UserUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=100)
    email: EmailStr | None = None


class UserResponse(UserBase):
    id: int
    is_active: bool
    is_verified: bool
    is_admin: bool
    created_at: datetime

    class Config:
        from_attributes = True
