from pydantic import BaseModel
from typing import Optional


class ArmFailureRequest(BaseModel):
    error_code: str


class PaymentInitiateRequest(BaseModel):
    instrument_id: str


class PaymentExecuteRequest(BaseModel):
    instrument_id: Optional[str] = None


class TransactionOut(BaseModel):
    id: str
    order_id: Optional[str] = None
    amount: int
    instrument_id: str
    instrument_name: str
    status: str
    failure_code: Optional[str] = None
    retry_of: Optional[str] = None
    created_at: str


class ReasoningTraceOut(BaseModel):
    id: str
    transaction_id: str
    trace_type: str
    reasoning: str
    instrument_selected: Optional[str] = None
    created_at: str


class DashboardOut(BaseModel):
    total_transactions: int
    successful_recoveries: int
    money_saved: int
    success_rate_before: float
    success_rate_after: float
    transactions: list[TransactionOut]
    traces: list[ReasoningTraceOut]
