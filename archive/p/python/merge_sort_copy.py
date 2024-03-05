import sys


def merge_sort(xs):
    def sort(xs):
        if len(xs) <= 0:
            return []
        if len(xs) == 1:
            return xs
        return sort([merge(xs[0], xs[1])] + sort(xs[2:]))
    split_xs = [[x] for x in xs]
    return sort(split_xs)[0]


def merge(xs, ys):
    if len(xs) <= 0:
        return ys
    if len(ys) <= 0:
        return xs
    if xs[0] < ys[0]:
        return [xs[0]] + merge(xs[1:], ys)
    return [ys[0]] + merge(xs, ys[1:])


def input_list(list_str):
    return [int(x.strip(" "), 10) for x in list_str.split(',')]


def exit_with_error():
    print('Usage: please provide a list of at least two integers to sort in the format "1, 2, 3, 4, 5"')
    sys.exit(1)


def prims_algorithm(weights):
    num_verticies = len(weights)
    map_c, map_e = {ind: max([elem for row in weights for elem in row]) +
                         1 for ind in range(num_verticies)}, {ind: None for ind in range(num_verticies)}
    set_f, set_q = set(), set(range(num_verticies))
    while len(set_q) > 0:
        v = [i for i in set_q if map_c[i] == min(
            [map_c[item] for item in set_q])][0]
        set_q.remove(v)
        set_f.add(v)
        set_f.add(map_e[v]) if map_e[v] is not None else None
        for w in range(num_verticies):
            if v == w:
                continue
            if w in set_q and 0 < weights[w][v] <= map_c[w]:
                map_c[w] = weights[w][v]
                map_e[w] = v
    return sum([weights[v][w] for v, w in map_e.items() if v is not None and w is not None])

def main(args):
    try:
        xs = input_list(args[0])
        if len(xs) <= 1:
            exit_with_error()
        print(merge_sort(xs))
    except (IndexError, ValueError):
        exit_with_error()


if __name__ == "__main__":
    main(sys.argv[1:])
