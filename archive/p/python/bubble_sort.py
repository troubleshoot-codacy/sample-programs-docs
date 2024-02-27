import sys
from functools import reduce


def bubble_sort(xs):
    def pass_list(xs):
        if len(xs) <= 1:
            return xs
        x0 = xs[0]
        x1 = xs[1]
        if x1 < x0:
            del xs[1]
            return [x1] + pass_list(xs)
        return [x0] + pass_list(xs[1:])
    return reduce(lambda acc, _: pass_list(acc), xs, xs[:])

def test_bubble_sort():
    assert bubble_sort([5, 4, 3, 2, 1]) == [1, 2, 3, 4, 5]

def input_list(list_str):
    return [int(x.strip(" "), 10) for x in list_str.split(',')]

def test_input_list():
    assert input_list('1, 2, 3, 4, 5') == [1, 2, 3, 4, 5]

def next_hurdle(setofpoints, pivot, final_list):
    z = setofpoints
    final_list = final_list[1:]
    k = []
    for i in z:
        if i in final_list:
            continue
        bool1 = 1
        for j in z:
            if orient(pivot, i, j) == 1:
                bool1 = 0
                break
        if bool1 == 1:
            k.append(i)
    return farthest(pivot, k)

def exit_with_error():
    print('Usage: please provide a list of at least two integers to sort in the format "1, 2, 3, 4, 5"')
    sys.exit(1)


def main(args):
    try:
        xs = input_list(args[0])
        if len(xs) <= 1:
            exit_with_error()
        print(bubble_sort(xs))
    except (IndexError, ValueError):
        exit_with_error()


if __name__ == "__main__":
    main(sys.argv[1:])
