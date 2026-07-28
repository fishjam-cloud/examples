"""Fishjam MoQ access token acquisition."""

from __future__ import annotations

import asyncio

from fishjam import FishjamClient, MoqAccess


async def fetch_moq_access(
    fishjam_id: str,
    management_token: str,
    *,
    publish_path: str = "",
    subscribe_path: str = "",
) -> MoqAccess:
    """Request a MoQ relay token granting publish/subscribe on the given path prefixes."""
    client = FishjamClient(fishjam_id=fishjam_id, management_token=management_token)
    return await asyncio.to_thread(
        client.create_moq_access,
        publish_path=publish_path,
        subscribe_path=subscribe_path,
    )
