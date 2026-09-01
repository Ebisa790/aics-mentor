# Remove UserDeviceOut and UserDeviceCreate, use DeviceResponse instead
from app.schemas.user import (
    DeviceResponse,
    RevokeDeviceResponse,
    RevokeOthersResponse,
    UserLogin,
    UserOut,
    UserProfileUpdate,
    UserRegister,
)