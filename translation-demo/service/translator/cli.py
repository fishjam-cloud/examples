"""Command-line entrypoint for the MoQ translation service."""

from __future__ import annotations

import argparse
import asyncio
import logging
import os

from .providers.google import (
    GOOGLE_DEFAULT_API_VERSION,
    GOOGLE_DEFAULT_MODEL,
    GoogleTranslationProvider,
)
from .service import TranslationSpec, run, run_with_fishjam, supported_target_languages


PROVIDER_CHOICES = ("google",)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Announce dynamic AI translations for MoQ audio broadcasts."
    )
    parser.add_argument(
        "--url",
        help="MoQ relay URL for direct, unauthenticated connections, "
        "for example https://relay.quic.video",
    )
    parser.add_argument(
        "--fishjam-id",
        default=os.environ.get("FISHJAM_ID"),
        help="Fishjam id (or full Fishjam URL) used to fetch a MoQ token "
        "(defaults to env FISHJAM_ID)",
    )
    parser.add_argument(
        "--fishjam-management-token",
        default=os.environ.get("FISHJAM_MANAGEMENT_TOKEN"),
        help="Fishjam management token used to fetch a MoQ token "
        "(defaults to env FISHJAM_MANAGEMENT_TOKEN)",
    )
    parser.add_argument(
        "--token-ttl",
        type=float,
        default=3600.0,
        help="MoQ token lifetime in seconds; the service reconnects with a "
        "fresh token before it expires",
    )
    parser.add_argument(
        "--prefix", default="", help="only watch broadcasts under this prefix"
    )
    parser.add_argument(
        "--providers",
        default=("google",),
        type=parse_providers,
        help="comma-separated dynamic translation providers to announce",
    )
    parser.add_argument(
        "--provider",
        dest="providers",
        type=parse_providers,
        help=argparse.SUPPRESS,
    )
    parser.add_argument(
        "--google-model",
        default=GOOGLE_DEFAULT_MODEL,
        help="Google Gemini Live translation model",
    )
    parser.add_argument(
        "--google-api-version",
        default=GOOGLE_DEFAULT_API_VERSION,
        help="Google Gemini Live API version",
    )
    parser.add_argument(
        "--google-echo-target-language",
        dest="google_echo_target_language",
        action="store_true",
        default=True,
        help="allow Google to speak input that is already in the target language",
    )
    parser.add_argument(
        "--no-google-echo-target-language",
        dest="google_echo_target_language",
        action="store_false",
        help="do not let Google speak input that is already in the target language",
    )
    parser.add_argument(
        "--max-latency-ms",
        type=int,
        default=1_000,
        help="maximum source media buffering latency in milliseconds",
    )
    parser.add_argument(
        "--no-tls-verify",
        dest="tls_verify",
        action="store_false",
        default=True,
        help="disable TLS verification for local testing",
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
        help="logging verbosity",
    )
    return parser.parse_args()


def configure_logging(level: str) -> None:
    app_level = getattr(logging, level)
    logging.basicConfig(
        level=app_level,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    logging.getLogger("websockets").setLevel(max(app_level, logging.INFO))


def main() -> None:
    args = parse_args()
    configure_logging(args.log_level)
    translations = build_translations(args)

    if args.fishjam_id and args.fishjam_management_token:
        coroutine = run_with_fishjam(
            fishjam_id=args.fishjam_id,
            management_token=args.fishjam_management_token,
            prefix=args.prefix,
            token_ttl=args.token_ttl,
            tls_verify=args.tls_verify,
            max_latency_ms=args.max_latency_ms,
            translations=translations,
        )
    elif args.url:
        coroutine = run(
            url=args.url,
            prefix=args.prefix,
            tls_verify=args.tls_verify,
            max_latency_ms=args.max_latency_ms,
            translations=translations,
        )
    else:
        raise SystemExit(
            "either --fishjam-id and --fishjam-management-token (or env "
            "FISHJAM_ID/FISHJAM_MANAGEMENT_TOKEN) or --url is required"
        )

    try:
        asyncio.run(coroutine)
    except KeyboardInterrupt:
        pass


def parse_providers(value: str) -> tuple[str, ...]:
    providers = tuple(
        provider.strip().lower()
        for provider in value.split(",")
        if provider.strip()
    )
    if not providers:
        raise argparse.ArgumentTypeError("at least one provider is required")

    invalid = [provider for provider in providers if provider not in PROVIDER_CHOICES]
    if invalid:
        valid = ", ".join(PROVIDER_CHOICES)
        raise argparse.ArgumentTypeError(
            f"unsupported provider(s): {', '.join(invalid)}; choose from {valid}"
        )

    duplicates = sorted(
        {provider for provider in providers if providers.count(provider) > 1}
    )
    if duplicates:
        raise argparse.ArgumentTypeError(f"duplicate provider(s): {', '.join(duplicates)}")

    return providers


def build_translations(args: argparse.Namespace) -> list[TranslationSpec]:
    providers = {
        provider_name: build_provider(provider_name, args)
        for provider_name in args.providers
    }
    return [
        TranslationSpec(
            provider_name=provider_name,
            target_language=target_language,
            provider=providers[provider_name],
        )
        for provider_name in args.providers
        for target_language in supported_target_languages(providers[provider_name])
    ]


def build_provider(provider_name: str, args: argparse.Namespace):
    if provider_name == "google":
        return GoogleTranslationProvider(
            model=args.google_model,
            api_version=args.google_api_version,
            echo_target_language=args.google_echo_target_language,
        )
    raise ValueError(f"unsupported provider: {provider_name}")


if __name__ == "__main__":
    main()
