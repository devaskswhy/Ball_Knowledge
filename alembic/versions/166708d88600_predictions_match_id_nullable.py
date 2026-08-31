"""predictions.match_id nullable

/predict never has a stored Match row to point at - it scores an arbitrary
home/away pairing on demand - so the initial migration's NOT NULL on
predictions.match_id was wrong from day one. services/models.py already
declares it nullable; this migration brings the schema in line so a fresh
Postgres deploy (via `alembic upgrade head`) doesn't reject every prediction
insert with a NOT NULL violation the way this column would otherwise.

Revision ID: 166708d88600
Revises: 49e255fd21cb
Create Date: 2026-08-31 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '166708d88600'
down_revision: Union[str, Sequence[str], None] = '49e255fd21cb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('predictions') as batch_op:
        batch_op.alter_column('match_id', existing_type=sa.Integer(), nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('predictions') as batch_op:
        batch_op.alter_column('match_id', existing_type=sa.Integer(), nullable=False)
