import uuid
from datetime import datetime

from pydantic import BaseModel, Field, ConfigDict

from app.models.conversation import TutorMode, MessageRole


class ChatRequest(BaseModel):
    """
    Payload for submitting an AI tutoring prompt or continuing a conversation.
    """
    conversation_id: uuid.UUID | None = Field(
        None, description="Existing conversation UUID, or omit to initiate a new session"
    )
    course_id: uuid.UUID | None = Field(
        None, description="Optional course context associated with the query"
    )
    mode: TutorMode = Field(
        TutorMode.EXPLANATION, description="Active AI tutor instruction mode"
    )
    message: str = Field(
        ..., min_length=1, max_length=5000, description="User prompt or question text"
    )


class MessageOut(BaseModel):
    id: uuid.UUID
    role: MessageRole
    content: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChatResponse(BaseModel):
    """
    Response returned containing the updated session identifier and the AI assistant's reply.
    """
    conversation_id: uuid.UUID = Field(..., description="Active session conversation UUID")
    reply: MessageOut = Field(..., description="Generated assistant message object")

    model_config = ConfigDict(from_attributes=True)


class ConversationOut(BaseModel):
    id: uuid.UUID
    title: str = Field(..., description="Auto-generated or user-defined session title")
    course_id: uuid.UUID | None
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConversationDetailOut(ConversationOut):
    messages: list[MessageOut] = Field(default_factory=list, description="Chronological chat history")