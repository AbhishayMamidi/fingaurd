import pytest
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from app.config import Settings

def test_database_url_with_at_symbol_in_password():
    """
    Validates that a password containing '@' (and '$') does not corrupt the
    hostname parsing. This explicitly guards against the regression:
    'could not translate host name "xN2$mQ8zL5@postgres" to address'.
    """
    tricky_password = "xN2$mQ8zL5@postgres"
    custom_settings = Settings(
        postgres_host="postgres",
        postgres_port=5432,
        postgres_user="finguard_user",
        postgres_password=tricky_password,
        postgres_db="finguard_transactions",
    )

    url_obj = custom_settings.get_database_url_object()
    assert url_obj.host == "postgres"
    assert url_obj.port == 5432
    assert url_obj.username == "finguard_user"
    assert url_obj.database == "finguard_transactions"
    assert url_obj.password == tricky_password

    # Rendered string must have percent-encoded '@' (%40)
    rendered_str = custom_settings.database_url
    assert "@postgres:5432" in rendered_str
    assert "%40" in rendered_str

    # Round-trip through SQLAlchemy's make_url
    parsed = make_url(rendered_str)
    assert parsed.host == "postgres"
    assert parsed.port == 5432
    assert parsed.username == "finguard_user"
    assert parsed.database == "finguard_transactions"
    assert parsed.password == tricky_password

    # create_engine must accept url_obj without URL parsing exceptions
    engine = create_engine(url_obj)
    assert engine.url.host == "postgres"
    assert engine.url.password == tricky_password

@pytest.mark.parametrize("special_password", [
    "P@ss#w0rd$123!",
    "secret#with#hashes",
    "dollar$ign$in$pass",
    "colon:and/slash?mark=1&amp=2",
    "percent%20and+plus_sign",
    "brackets[and]braces{123}",
    "xN2$mQ8zL5@#%^&*()+=/?:;[]~",
])
def test_database_url_various_special_characters(special_password):
    """
    Validates that passwords containing any URL-reserved characters correctly
    preserve the parsed hostname as 'postgres' and the password unaltered.
    """
    custom_settings = Settings(
        postgres_host="postgres",
        postgres_port=5432,
        postgres_user="finguard_user",
        postgres_password=special_password,
        postgres_db="finguard_transactions",
    )

    url_obj = custom_settings.get_database_url_object()
    assert url_obj.host == "postgres"
    assert url_obj.password == special_password

    # Rendered string round-trip test
    rendered_str = custom_settings.database_url
    parsed = make_url(rendered_str)
    assert parsed.host == "postgres"
    assert parsed.password == special_password

    # Ensure engine initializes with URL object
    engine = create_engine(url_obj)
    assert engine.url.host == "postgres"
    assert engine.url.password == special_password
