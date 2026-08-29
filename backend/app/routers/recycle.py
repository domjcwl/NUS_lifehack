"""QR code routes.

Scanning the sticker on a bin opens the frontend at `/recycle/{qr_code_id}`, which
calls these endpoints to find out which bin it is and to submit proof.
"""

from typing import Annotated

from fastapi import APIRouter, File, Form, Path, UploadFile, status

from app.config import settings
from app.core.deps import CurrentUser, SessionDep
from app.models.enums import WasteType
from app.schemas.activity import SubmissionResult
from app.schemas.bin import QRBinRead
from app.services import bin_service, submission_service

router = APIRouter(prefix="/recycle", tags=["recycle"])

SUBMIT_DESCRIPTION = """
Send `multipart/form-data` with a photo or short video.

Identify yourself with `?user_id=<id>` or an `X-User-Id` header.

`waste_type` defaults to whatever the bin is for, and is rejected if the bin does not
accept it. `group_id` is optional; when given, the points also count towards that
group's total and its pet.

**Checks applied, in order:** the QR code resolves to an active bin, the stream is
accepted, the file type and size are allowed, you are outside the per-bin cooldown,
you are under the daily cap, and the same photo has not been submitted before
(perceptual hash, so resizing or recompressing does not defeat it).
"""


@router.get(
    "/{qr_code_id}",
    response_model=QRBinRead,
    summary="Resolve a scanned QR code to its bin",
    description=(
        "Verifies the code exists and the bin is in service, then returns everything "
        "the scan page needs: the bin, the points on offer, and where to submit proof."
        " Try `sg-nus-lib-01` (recycling) or `sg-nus-eng-ew-01` (e-waste). "
        "`sg-nus-sci-01` is seeded as out of service."
    ),
    responses={404: {"description": "Unknown QR code, or the bin is out of service"}},
)
def resolve_qr_code(
    session: SessionDep,
    qr_code_id: str = Path(
        max_length=64,
        description="The value encoded in the bin's QR sticker.",
        examples=["sg-nus-lib-01"],
    ),
) -> QRBinRead:
    return bin_service.resolve_qr_code(session, qr_code_id)


@router.post(
    "/{qr_code_id}/submit",
    response_model=SubmissionResult,
    status_code=status.HTTP_201_CREATED,
    summary="Submit photo proof of recycling at this bin",
    description=SUBMIT_DESCRIPTION,
    responses={
        404: {"description": "Unknown QR code, bin out of service, or unknown group"},
        409: {"description": "This photo has already been submitted"},
        422: {"description": "Bad file type, file too large, or stream not accepted"},
        429: {"description": "Per-bin cooldown or daily cap reached"},
    },
)
async def submit_proof(
    session: SessionDep,
    current_user: CurrentUser,
    qr_code_id: Annotated[str, Path(max_length=64, examples=["sg-nus-eng-ew-01"])],
    file: Annotated[
        UploadFile, File(description="Photo or short video of you recycling.")
    ],
    waste_type: Annotated[WasteType | None, Form()] = None,
    caption: Annotated[str | None, Form(max_length=280)] = None,
    group_id: Annotated[int | None, Form()] = None,
) -> SubmissionResult:
    # Read with a cap so an oversized upload cannot exhaust memory before the size
    # check runs. One byte over the limit is enough to detect "too big".
    data = await file.read(settings.max_upload_bytes + 1)

    # Content types arrive as "image/jpeg" or sometimes "image/jpeg; charset=..." .
    content_type = (file.content_type or "").split(";")[0].strip().lower()

    return submission_service.submit(
        session,
        user=current_user,
        qr_code_id=qr_code_id,
        data=data,
        content_type=content_type,
        waste_type=waste_type,
        caption=caption,
        group_id=group_id,
    )
