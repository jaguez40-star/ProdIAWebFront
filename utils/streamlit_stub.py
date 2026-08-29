# Temporary patch for Streamlit imports in Flask version
# This file provides stub functions to prevent import errors


class StreamlitStub:
    def __getattr__(self, name):
        return lambda *args, **kwargs: None

    def __call__(self, *args, **kwargs):
        return self

    @property
    def session_state(self):
        return {}

    @property
    def secrets(self):
        return {}


# Create a global st object to replace streamlit imports
st = StreamlitStub()
