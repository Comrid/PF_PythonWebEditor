

def import_findee_by_platform():
    import sys, platform
    if platform.system() == "Windows":
        sys.path.insert(0, "F:/Git/findee")
    from findee import Findee, FindeeFormatter